import { crJson } from "./cr_api.js";
import {
  normalizeTagForDb,
  isTargetMode,
  normalizeType,
  makeDeckKeySortedWithKindAndSupport,
  makeBattleId,
  judgeResultFromBattlelog,
  cardSlotKindFromBattlelog,
} from "./domain.js";
import {
  battleExists,
  upsertMePlayer,
  insertDeckIfNotExists,
  upsertMyDeckCardsAsFetched,
  upsertBattle,
  upsertOpponentCardsAsFetched,
} from "./db.js";

async function upsertOneEntry(env, entry) {
  const gm = entry?.gameMode?.name;
  if (!isTargetMode(gm)) return { status: "skipped", reason: `non-target gameMode: ${gm}` };

  const my = entry?.team?.[0];
  const op = entry?.opponent?.[0];
  if (!my?.tag || !op?.tag) return { status: "skipped", reason: "missing team/opponent" };
  if (entry?.team?.length !== 1 || entry?.opponent?.length !== 1)
    return { status: "skipped", reason: "not 1v1 structure" };

  const arenaId = Number.isInteger(entry?.arena?.id) ? entry.arena.id : null;
  const gameModeId = Number.isInteger(entry?.gameMode?.id) ? entry.gameMode.id : null;

  const myTagDb = normalizeTagForDb(my.tag);
  const opTagDb = normalizeTagForDb(op.tag);

  const battleTime = entry?.battleTime;
  const type = normalizeType(entry?.type);
  const battleId = makeBattleId({ myTagDb, opTagDb, battleTime, type });

  const mySupport = Array.isArray(my?.supportCards) ? my.supportCards[0] : null;
  const opSupport = Array.isArray(op?.supportCards) ? op.supportCards[0] : null;

  // ★ my_deck_key は player_tag prefix 付きに変更
  const myDeckKey = makeDeckKeySortedWithKindAndSupport(myTagDb, my?.cards, mySupport);
  if (!myDeckKey) return { status: "skipped", reason: "cannot make my_deck_key (need 8 cards + support?)" };

  const result = judgeResultFromBattlelog(my, op);

  await upsertMePlayer(env, myTagDb, my?.name);
  await insertDeckIfNotExists(env, myDeckKey, myTagDb); // deck_name更新しない
  await upsertMyDeckCardsAsFetched(env, myDeckKey, my?.cards, mySupport, cardSlotKindFromBattlelog);
  await upsertBattle(env, battleId, myTagDb, battleTime, result, myDeckKey, arenaId, gameModeId);
  await upsertOpponentCardsAsFetched(env, battleId, op?.cards, opSupport, cardSlotKindFromBattlelog);

  return { status: "upserted", battle_id: battleId, my_deck_key: myDeckKey };
}

export async function syncCore(env, tagApi) {
  const list = await crJson(`/v1/players/${encodeURIComponent(tagApi)}/battlelog`, env);
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: "battlelog empty", synced: null, results: [] };
  }

  const counts = {
    total_fetched: list.length,
    upserted: 0,
    skipped: 0,
    skipped_non_target: 0,
    skipped_other: 0,
    stopped_early: 0,
  };

  const results = [];

  for (const entry of list) {
    const gm = entry?.gameMode?.name;
    if (!isTargetMode(gm)) {
      counts.skipped += 1;
      counts.skipped_non_target += 1;
      results.push({ status: "skipped", reason: `non-target gameMode: ${gm}` });
      continue;
    }

    const my = entry?.team?.[0];
    const op = entry?.opponent?.[0];
    if (!my?.tag || !op?.tag) {
      counts.skipped += 1;
      counts.skipped_other += 1;
      results.push({ status: "skipped", reason: "missing team/opponent" });
      continue;
    }

    const myTagDb = normalizeTagForDb(my.tag);
    const opTagDb = normalizeTagForDb(op.tag);
    const battleTime = entry?.battleTime;
    const type = normalizeType(entry?.type);
    const battleId = makeBattleId({ myTagDb, opTagDb, battleTime, type });

    if (await battleExists(env, battleId)) {
      counts.stopped_early = 1;
      results.push({ status: "skipped", reason: "already exists -> stop sync", battle_id: battleId });
      break;
    }

    try {
      const r = await upsertOneEntry(env, entry);
      results.push(r);

      if (r.status === "upserted") counts.upserted += 1;
      else {
        counts.skipped += 1;
        counts.skipped_other += 1;
      }
    } catch (e) {
      results.push({ status: "skipped", reason: `exception: ${String(e?.message || e)}` });
      counts.skipped += 1;
      counts.skipped_other += 1;
    }
  }

  return { ok: true, synced: counts, results };
}
