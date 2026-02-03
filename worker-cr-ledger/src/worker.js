import { crJson, crCards } from "./cr_api.js";
import {
  normalizeTagForApi,
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
  statsOpponentTrendLast,
  statsOpponentTrendSince,
  statsMatchupByCardLast,
  statsPriorityLast,
  statsMyDecksLast,
  listPlayers,
	updateDeckName,
	getMyDeckCards
} from "./db.js";

import { json, clampInt, route, handleFetch, readJson } from "./http.js";

/** ---------- param helpers ---------- */

function requirePlayerTagDb(url) {
  const p = (url.searchParams.get("player_tag") || "").trim().toUpperCase();
  if (!p) throw new Error("player_tag required");
  // DBは #なしで持つ想定なので、#が来ても許容して外す
  return normalizeTagForDb(p);
}

function requirePlayerTagApi(url) {
  const p = (url.searchParams.get("player_tag") || "").trim().toUpperCase();
  if (!p) throw new Error("player_tag required");
  return normalizeTagForApi(p);
}

/** ---------- sync core ---------- */

async function upsertOneEntry(env, entry) {
  const gm = entry?.gameMode?.name;
  if (!isTargetMode(gm)) return { status: "skipped", reason: `non-target gameMode: ${gm}` };

  const my = entry?.team?.[0];
  const op = entry?.opponent?.[0];
  if (!my?.tag || !op?.tag) return { status: "skipped", reason: "missing team/opponent" };
  if (entry?.team?.length !== 1 || entry?.opponent?.length !== 1)
    return { status: "skipped", reason: "not 1v1 structure" };

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
  await upsertBattle(env, battleId, myTagDb, battleTime, result, myDeckKey);
  await upsertOpponentCardsAsFetched(env, battleId, op?.cards, opSupport, cardSlotKindFromBattlelog);

  return { status: "upserted", battle_id: battleId, my_deck_key: myDeckKey };
}

async function syncCore(env, tagApi) {
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

/** ---------- handlers ---------- */

async function handleRoot() {
  return new Response(
    [
      "OK",
      "Try:",
      "POST  /api/sync?player_tag=GYVCJJCR0",
      "GET   /api/players",
      "GET   /api/my-deck-cards?my_deck_key=...",
      "GET   /api/stats/opponent-trend?player_tag=GYVCJJCR0&last=200",
      "GET   /api/stats/opponent-trend?player_tag=GYVCJJCR0&since=20260101T000000.000Z",
      "GET   /api/stats/my-decks?player_tag=GYVCJJCR0&last=200",
      "GET   /api/stats/matchup-by-card?my_deck_key=...&last=500&min=10",
      "GET   /api/stats/priority?player_tag=GYVCJJCR0&my_deck_key=...&last=500&min=10",
      "GET   /api/cards?nocache=1",
      "PATCH /api/my-decks/name",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}

async function handlePlayers(env, url) {
  const out = await listPlayers(env);
  return json({ ok: true, ...out });
}

async function handleSyncHttp(env, url) {
  const tagApi = requirePlayerTagApi(url);
  const out = await syncCore(env, tagApi);
  if (!out.ok) return json(out, 400);
  return json(out, 200);
}

async function handleOpponentTrend(env, url) {
  const playerTagDb = requirePlayerTagDb(url);

  const since = url.searchParams.get("since");
  if (since) {
    const out = await statsOpponentTrendSince(env, playerTagDb, since);
    return json({ ok: true, player_tag: playerTagDb, filter: { since }, ...out });
  }

  const last = clampInt(url.searchParams.get("last"), 1, 5000, 200);
  const out = await statsOpponentTrendLast(env, playerTagDb, last);
  return json({ ok: true, player_tag: playerTagDb, filter: { last }, ...out });
}

async function handleMatchupByCard(env, url) {
  const myDeckKey = url.searchParams.get("my_deck_key");
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const last = clampInt(url.searchParams.get("last"), 1, 5000, 500);

  const out = await statsMatchupByCardLast(env, myDeckKey, last);
  return json({ ok: true, my_deck_key: myDeckKey, filter: { last }, ...out });
}

async function handlePriority(env, url) {
  // trend は player_tag、weakness は my_deck_key に基づく
  const playerTagDb = requirePlayerTagDb(url);

  const myDeckKey = url.searchParams.get("my_deck_key");
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const last = clampInt(url.searchParams.get("last"), 1, 5000, 500);

  const out = await statsPriorityLast(env, playerTagDb, myDeckKey, last);
  return json({ ok: true, player_tag: playerTagDb, my_deck_key: myDeckKey, filter: { last }, ...out });
}

async function handleMyDecks(env, url) {
  const playerTagDb = requirePlayerTagDb(url);
  const last = clampInt(url.searchParams.get("last"), 1, 5000, 200);
  const out = await statsMyDecksLast(env, playerTagDb, last);
  return json({ ok: true, player_tag: playerTagDb, filter: { last }, ...out });
}

async function handleCards(req, env) {
  const url = new URL(req.url);
  const bypass = url.searchParams.get("nocache") === "1";

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), req);

  if (!bypass) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const data = await crCards(env);

  const payload = {
    ok: true,
    source: "proxy.royaleapi.dev",
    items: Array.isArray(data?.items) ? data.items : [],
    supportItems: Array.isArray(data?.supportItems) ? data.supportItems : [],
  };

  // Cache-Control は最初から付けておく（後からいじると clone のタイミングで事故りやすい）
  const res = json(payload, 200, { "Cache-Control": "public, max-age=43200" });

  if (!bypass) {
    await cache.put(cacheKey, res.clone());
  }

  return res;
}


function normalizeDeckNameAllowClear(v) {
  // undefined/null はエラーにしたいならここで分ける
  if (v === undefined) return { ok: false, error: "deck_name required" };

  const s = (v ?? "").toString().trim();

  // 空なら「クリア」扱いで NULL
  if (s === "") return { ok: true, value: null };

  // 長さ制限（好みで）
  if (s.length > 40) return { ok: false, error: "deck_name too long (max 40)" };

  return { ok: true, value: s };
}

async function handleUpdateDeckName(req, env) {
  const body = await readJson(req);

  const myDeckKey = (body?.my_deck_key ?? "").toString().trim();
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const norm = normalizeDeckNameAllowClear(body?.deck_name);
  if (!norm.ok) return json({ ok: false, error: norm.error }, 400);

  const out = await updateDeckName(env, myDeckKey, norm.value);

  if ((out.changes || 0) === 0) {
    return json({ ok: false, error: "deck not found" }, 404);
  }

  return json({ ok: true, my_deck_key: myDeckKey, deck_name: norm.value }, 200);
}

async function handleMyDeckCards(env, url) {
  const myDeckKey = (url.searchParams.get("my_deck_key") || "").trim();
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const out = await getMyDeckCards(env, myDeckKey);

  return json({ ok: true, my_deck_key: myDeckKey, ...out }, 200);
}

/** ---------- worker ---------- */

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    return handleFetch(req, env, async () => {
      return route(req, env, url, {
        "GET /": async () => await handleRoot(),

        "GET /api/cards": async (req, env) => await handleCards(req, env),

        "GET /api/players": async (_req, env, url) => await handlePlayers(env, url),

				"GET /api/my-deck-cards": async (_req, env, url) => await handleMyDeckCards(env, url),

        "POST /api/sync": async (_req, env, url) => await handleSyncHttp(env, url),

        "GET /api/stats/opponent-trend": async (_req, env, url) => await handleOpponentTrend(env, url),

        "GET /api/stats/my-decks": async (_req, env, url) => await handleMyDecks(env, url),

        "GET /api/stats/matchup-by-card": async (_req, env, url) => await handleMatchupByCard(env, url),

        "GET /api/stats/priority": async (_req, env, url) => await handlePriority(env, url),

				"PATCH /api/my-decks/name": async (req, env) => await handleUpdateDeckName(req, env),
      });
    });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const { players } = await listPlayers(env);

      for (const p of players) {
        const tagDb = p.player_tag;
        const tagApi = `#${tagDb}`;
        await syncCore(env, tagApi);
      }
    })());
  },
};
