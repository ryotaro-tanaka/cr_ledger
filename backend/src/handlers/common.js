import { clampInt, json, readJson } from "../http.js";
import { normalizeTagForApi } from "../domain.js";
import { syncCore } from "../sync.js";
import { crCards } from "../cr_api.js";
import { statsMyDecksSeasons } from "../db/analytics/legacy.js";
import { findSeasonLowerBound } from "../db/decks.js";
import {
  listPlayers,
  updateDeckName,
  getMyDeckCards,
  listCardClasses,
  listCardTraits,
  listCardTraitKvs,
} from "../db/read.js";

const TRAIT_FIELDS = [
  "is_air",
  "can_damage_air",
  "primary_target_buildings",
  "is_aoe",
  "is_swarm_like",
];

const SLOT_KINDS = ["normal", "evolution", "hero", "support"];

function toTraitBool(value) {
  if (value === null || value === undefined) return true;
  return Number(value) !== 0;
}

function resolveCardTraits(cardTraits, cardTraitKvs, slotKind) {
  const resolved = new Map();

  for (const traitKey of TRAIT_FIELDS) {
    if (Number(cardTraits?.[traitKey]) === 1) resolved.set(traitKey, true);
  }

  const kvChosen = new Map();
  for (const row of cardTraitKvs) {
    if (row.slot_kind !== "all" && row.slot_kind !== slotKind) continue;

    const prev = kvChosen.get(row.trait_key);
    if (!prev || (prev.slot_kind === "all" && row.slot_kind !== "all")) {
      kvChosen.set(row.trait_key, row);
    }
  }

  for (const [traitKey, row] of kvChosen.entries()) {
    if (TRAIT_FIELDS.includes(traitKey)) continue;

    if (toTraitBool(row.trait_value)) {
      resolved.set(traitKey, true);
    } else {
      resolved.delete(traitKey);
    }
  }

  for (const row of cardTraitKvs) {
    if (row.slot_kind !== slotKind) continue;
    if (!TRAIT_FIELDS.includes(row.trait_key)) continue;

    if (toTraitBool(row.trait_value)) {
      resolved.set(row.trait_key, true);
    } else {
      resolved.delete(row.trait_key);
    }
  }

  return resolved;
}

export async function handleCommonPlayers(env, url) {
  const seasons = clampInt(url.searchParams.get("seasons"), 1, 6, 2);
  const since = await findSeasonLowerBound(env, seasons);

  const { players } = await listPlayers(env);

  const detailed = [];

  for (const player of players) {
    const playerTagDb = player.player_tag;
    const stats = await statsMyDecksSeasons(env, playerTagDb, since);

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

  return json({ ok: true, filter: { seasons }, players: detailed });
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
  if (v === undefined) return { ok: false, error: "deck_name required" };

  const s = (v ?? "").toString().trim();

  if (s === "") return { ok: true, value: null };

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

export async function handleCommonClasses(env) {
  const { classes } = await listCardClasses(env);

  const grouped = new Map();
  for (const row of classes) {
    if (!grouped.has(row.class_key)) grouped.set(row.class_key, []);
    grouped.get(row.class_key).push(Number(row.card_id));
  }

  const payload = Array.from(grouped.entries())
    .map(([class_key, card_ids]) => ({
      class_key,
      card_ids: [...new Set(card_ids)].sort((a, b) => a - b),
    }))
    .sort((a, b) => String(a.class_key).localeCompare(String(b.class_key)));

  return json({ ok: true, classes: payload }, 200);
}

export async function handleCommonTraits(env) {
  const [{ traits }, { trait_kvs }] = await Promise.all([
    listCardTraits(env),
    listCardTraitKvs(env),
  ]);

  const cardTraitsById = new Map(traits.map((row) => [row.card_id, row]));
  const cardTraitKvsById = new Map();

  for (const row of trait_kvs) {
    if (!cardTraitKvsById.has(row.card_id)) cardTraitKvsById.set(row.card_id, []);
    cardTraitKvsById.get(row.card_id).push(row);
  }

  const allCardIds = new Set([...cardTraitsById.keys(), ...cardTraitKvsById.keys()]);

  const traitToCardIds = new Map();
  for (const cardId of allCardIds) {
    const cardTrait = cardTraitsById.get(cardId);
    const kvs = cardTraitKvsById.get(cardId) || [];

    const resolvedTraits = new Set();
    for (const slotKind of SLOT_KINDS) {
      for (const traitKey of resolveCardTraits(cardTrait, kvs, slotKind).keys()) {
        resolvedTraits.add(traitKey);
      }
    }

    for (const traitKey of resolvedTraits) {
      if (!traitToCardIds.has(traitKey)) traitToCardIds.set(traitKey, []);
      traitToCardIds.get(traitKey).push(Number(cardId));
    }
  }

  const payload = Array.from(traitToCardIds.entries())
    .map(([trait_key, card_ids]) => ({
      trait_key,
      card_ids: [...new Set(card_ids)].sort((a, b) => a - b),
    }))
    .sort((a, b) => String(a.trait_key).localeCompare(String(b.trait_key)));

  return json({ ok: true, traits: payload }, 200);
}
