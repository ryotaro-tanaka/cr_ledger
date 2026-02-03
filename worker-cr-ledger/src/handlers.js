import { crCards } from "./cr_api.js";
import { clampInt, json, readJson } from "./http.js";
import { syncCore } from "./sync.js";
import { requirePlayerTagApi, requirePlayerTagDb } from "./params.js";
import {
  statsMyDecksLast,
  listPlayers,
  updateDeckName,
  getMyDeckCards,
} from "./db.js";

export async function handleRoot() {
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

export async function handlePlayers(env) {
  const out = await listPlayers(env);
  return json({ ok: true, ...out });
}

export async function handleSyncHttp(env, url) {
  const tagApi = requirePlayerTagApi(url);
  const out = await syncCore(env, tagApi);
  if (!out.ok) return json(out, 400);
  return json(out, 200);
}

export async function handleMyDecks(env, url) {
  const playerTagDb = requirePlayerTagDb(url);
  const last = clampInt(url.searchParams.get("last"), 1, 5000, 200);
  const out = await statsMyDecksLast(env, playerTagDb, last);
  return json({ ok: true, player_tag: playerTagDb, filter: { last }, ...out });
}

export async function handleCards(req, env) {
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

export async function handleUpdateDeckName(req, env) {
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

export async function handleMyDeckCards(env, url) {
  const myDeckKey = (url.searchParams.get("my_deck_key") || "").trim();
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const out = await getMyDeckCards(env, myDeckKey);

  return json({ ok: true, my_deck_key: myDeckKey, ...out }, 200);
}
