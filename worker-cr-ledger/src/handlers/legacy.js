import { clampInt, json } from "../http.js";
import { requirePlayerTagDb } from "../params.js";
import {
  statsOpponentTrendLast,
  statsOpponentTrendSince,
  statsMatchupByCardLast,
  statsPriorityLast,
} from "../db/analytics/legacy.js";

export async function handleOpponentTrend(env, url) {
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

export async function handleMatchupByCard(env, url) {
  const myDeckKey = url.searchParams.get("my_deck_key");
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const last = clampInt(url.searchParams.get("last"), 1, 5000, 500);

  const out = await statsMatchupByCardLast(env, myDeckKey, last);
  return json({ ok: true, my_deck_key: myDeckKey, filter: { last }, ...out });
}

export async function handlePriority(env, url) {
  // trend は player_tag、weakness は my_deck_key に基づく
  const playerTagDb = requirePlayerTagDb(url);

  const myDeckKey = url.searchParams.get("my_deck_key");
  if (!myDeckKey) return json({ ok: false, error: "my_deck_key required" }, 400);

  const last = clampInt(url.searchParams.get("last"), 1, 5000, 500);

  const out = await statsPriorityLast(env, playerTagDb, myDeckKey, last);
  return json({ ok: true, player_tag: playerTagDb, my_deck_key: myDeckKey, filter: { last }, ...out });
}
