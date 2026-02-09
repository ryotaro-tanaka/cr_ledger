import { json } from "../http.js";

const TRAIT_FIELDS = [
  "is_air",
  "can_damage_air",
  "primary_target_buildings",
  "is_aoe",
  "is_swarm_like",
];

function buildTraitKeys(cardTraits, traitKvs, slotKind) {
  const traitMap = new Map();

  for (const key of TRAIT_FIELDS) {
    if (Number(cardTraits?.[key]) === 1) {
      traitMap.set(key, "all");
    }
  }

  for (const row of traitKvs) {
    if (row.slot_kind !== "all" && row.slot_kind !== slotKind) continue;
    const existing = traitMap.get(row.trait_key);
    if (!existing || (existing === "all" && row.slot_kind !== "all")) {
      traitMap.set(row.trait_key, row.slot_kind);
    }
  }

  return Array.from(traitMap.keys());
}

function countByKey(items, key) {
  const counts = new Map();
  for (const item of items) {
    const current = counts.get(item[key]) ?? 0;
    counts.set(item[key], current + 1);
  }
  return Array.from(counts.entries())
    .map(([entryKey, count]) => ({ [key]: entryKey, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a[key]).localeCompare(String(b[key]));
    });
}

export async function handleDeckSummary(env, myDeckKeyRaw) {
  const raw = (myDeckKeyRaw ?? "").toString().trim();
  if (!raw) return json({ ok: false, error: "my_deck_key required" }, 400);

  let myDeckKey;
  try {
    myDeckKey = decodeURIComponent(raw);
  } catch {
    return json({ ok: false, error: "invalid my_deck_key" }, 400);
  }

  const cardsResult = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind
    FROM my_deck_cards
    WHERE my_deck_key = ?
    ORDER BY slot ASC;
    `
  ).bind(myDeckKey).all();

  const cards = cardsResult.results || [];
  if (cards.length === 0) {
    return json({ ok: true, deck_traits: [], deck_classes: [], cards: [] }, 200);
  }

  const cardIds = [...new Set(cards.map((card) => card.card_id))];
  const placeholders = cardIds.map(() => "?").join(",");

  const cardTraitsResult = await env.DB.prepare(
    `
    SELECT
      card_id,
      card_type,
      is_air,
      can_damage_air,
      primary_target_buildings,
      is_aoe,
      is_swarm_like
    FROM card_traits
    WHERE card_id IN (${placeholders});
    `
  ).bind(...cardIds).all();

  const traitKvResult = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind,
      trait_key
    FROM card_trait_kv
    WHERE card_id IN (${placeholders});
    `
  ).bind(...cardIds).all();

  const classResult = await env.DB.prepare(
    `
    SELECT
      card_id,
      class_key
    FROM card_classes
    WHERE card_id IN (${placeholders});
    `
  ).bind(...cardIds).all();

  const cardTraitsById = new Map(
    (cardTraitsResult.results || []).map((row) => [row.card_id, row])
  );

  const traitKvById = new Map();
  for (const row of traitKvResult.results || []) {
    if (!traitKvById.has(row.card_id)) traitKvById.set(row.card_id, []);
    traitKvById.get(row.card_id).push(row);
  }

  const classesById = new Map();
  for (const row of classResult.results || []) {
    if (!classesById.has(row.card_id)) classesById.set(row.card_id, []);
    classesById.get(row.card_id).push(row.class_key);
  }

  const cardSummaries = cards.map((card) => {
    const cardTraits = cardTraitsById.get(card.card_id);
    const traitKeys = buildTraitKeys(
      cardTraits,
      traitKvById.get(card.card_id) || [],
      card.slot_kind
    );
    const classes = classesById.get(card.card_id) || [];

    return {
      card_id: card.card_id,
      slot_kind: card.slot_kind,
      card_type: cardTraits?.card_type ?? null,
      card_traits: traitKeys,
      classes,
    };
  });

  const deckTraits = countByKey(
    cardSummaries.flatMap((card) =>
      card.card_traits.map((trait) => ({ trait_key: trait }))
    ),
    "trait_key"
  );

  const deckClasses = countByKey(
    cardSummaries.flatMap((card) =>
      card.classes.map((classKey) => ({ class_key: classKey }))
    ),
    "class_key"
  );

  return json(
    {
      ok: true,
      deck_traits: deckTraits,
      deck_classes: deckClasses,
      cards: cardSummaries,
    },
    200
  );
}
