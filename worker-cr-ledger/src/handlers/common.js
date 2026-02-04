import { clampInt, json, readJson } from "../http.js";
import { normalizeTagForApi } from "../domain.js";
import { syncCore } from "../sync.js";
import { statsMyDecksLast } from "../db/analytics/legacy.js";
import { listPlayers, updateDeckName, getMyDeckCards } from "../db/read.js";
import { normalizeDeckNameAllowClear } from "./deck_name.js";

export async function handleCommonPlayers(env, url) {
  const last = clampInt(url.searchParams.get("last"), 1, 5000, 200);
  const { players } = await listPlayers(env);

  const detailed = [];

  for (const player of players) {
    const playerTagDb = player.player_tag;
    const stats = await statsMyDecksLast(env, playerTagDb, last);

    const decks = [];
    for (const deck of stats.decks || []) {
      const cards = await getMyDeckCards(env, deck.my_deck_key);
      decks.push({
        my_deck_key: deck.my_deck_key,
        deck_name: deck.deck_name ?? null,
        battles: deck.battles ?? 0,
        cards: cards.cards || [],
      });
    }

    detailed.push({
      player_tag: player.player_tag,
      player_name: player.player_name,
      total_battles: stats.total_battles ?? 0,
      decks,
    });
  }

  return json({ ok: true, filter: { last }, players: detailed });
}

export async function handleCommonUpdateDeckName(req, env) {
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

function mergeSyncCounts(base, next) {
  return {
    total_fetched: base.total_fetched + next.total_fetched,
    upserted: base.upserted + next.upserted,
    skipped: base.skipped + next.skipped,
    skipped_non_target: base.skipped_non_target + next.skipped_non_target,
    skipped_other: base.skipped_other + next.skipped_other,
    stopped_early: base.stopped_early + next.stopped_early,
  };
}

export async function handleCommonSync(req, env) {
  const body = await readJson(req);
  const rawTag = body?.player_tag;

  if (rawTag !== undefined && rawTag !== null) {
    const tag = normalizeTagForApi(rawTag);
    if (!tag || tag === "#") return json({ ok: false, error: "player_tag required" }, 400);

    const out = await syncCore(env, tag);
    if (!out.ok) return json(out, 400);
    return json(out, 200);
  }

  const { players } = await listPlayers(env);
  if (!players || players.length === 0) {
    return json({
      ok: true,
      synced: {
        total_fetched: 0,
        upserted: 0,
        skipped: 0,
        skipped_non_target: 0,
        skipped_other: 0,
        stopped_early: 0,
      },
      results: [],
    });
  }

  let counts = {
    total_fetched: 0,
    upserted: 0,
    skipped: 0,
    skipped_non_target: 0,
    skipped_other: 0,
    stopped_early: 0,
  };
  const results = [];

  for (const player of players) {
    const tagApi = normalizeTagForApi(player.player_tag);
    const out = await syncCore(env, tagApi);
    if (!out.ok) {
      counts = mergeSyncCounts(counts, {
        total_fetched: 0,
        upserted: 0,
        skipped: 1,
        skipped_non_target: 0,
        skipped_other: 1,
        stopped_early: 0,
      });
      results.push({ status: "skipped", reason: `player ${tagApi}: ${out.error}` });
      continue;
    }

    counts = mergeSyncCounts(counts, out.synced);
    results.push(...(out.results || []));
  }

  return json({ ok: true, synced: counts, results }, 200);
}
