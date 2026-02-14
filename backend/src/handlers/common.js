import { clampInt, json, readJson } from "../http.js";
import { normalizeTagForApi } from "../domain.js";
import { syncCore } from "../sync.js";
import { crCards } from "../cr_api.js";
import { statsMyDecksLast } from "../db/analytics/legacy.js";
import { listPlayers, updateDeckName, getMyDeckCards } from "../db/read.js";

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

export async function handleCommonSync(req, env) {
  const body = await readJson(req);
  const rawTag = body?.player_tag;

  if (rawTag === undefined || rawTag === null) {
    return json({ ok: false, error: "player_tag required" }, 400);
  }

  const tag = normalizeTagForApi(rawTag);
  if (!tag || tag === "#") {
    return json({ ok: false, error: "player_tag required" }, 400);
  }

  const out = await syncCore(env, tag);
  if (!out.ok) return json(out, 400);
  return json(out, 200);
}

export async function handleCommonCards(req, env) {
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

  const res = json(payload, 200, { "Cache-Control": "public, max-age=43200" });

  if (!bypass) {
    await cache.put(cacheKey, res.clone());
  }

  return res;
}
