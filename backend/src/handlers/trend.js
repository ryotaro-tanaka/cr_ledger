import { clampInt, json } from "../http.js";
import { normalizeTagForDb } from "../domain.js";
import { findSeasonLowerBound } from "../db/decks.js";

const BASE_TRAIT_KEYS = [
  "is_air",
  "can_damage_air",
  "primary_target_buildings",
  "is_aoe",
  "is_swarm_like",
];

function isAllSlotKindApplicable(cardType, slotKind) {
  if (cardType === "support") return slotKind === "support";
  if (cardType === "unit" || cardType === "spell" || cardType === "building") {
    return slotKind === "normal" || slotKind === "evolution" || slotKind === "hero";
  }
  return true;
}

function toTraitBool(value) {
  if (value === null || value === undefined) return true;
  return Number(value) !== 0;
}

function resolveCardTraits(cardTraits, cardTraitKvs, slotKind) {
  const resolved = new Map();

  for (const traitKey of BASE_TRAIT_KEYS) {
    if (Number(cardTraits?.[traitKey]) === 1) resolved.set(traitKey, true);
  }

  const kvChosen = new Map();
  for (const row of cardTraitKvs) {
    if (row.slot_kind === "all" && !isAllSlotKindApplicable(cardTraits?.card_type, slotKind)) continue;
    if (row.slot_kind !== "all" && row.slot_kind !== slotKind) continue;

    const prev = kvChosen.get(row.trait_key);
    if (!prev || (prev.slot_kind === "all" && row.slot_kind !== "all")) {
      kvChosen.set(row.trait_key, row);
    }
  }

  for (const [traitKey, row] of kvChosen.entries()) {
    if (BASE_TRAIT_KEYS.includes(traitKey)) continue;
    if (toTraitBool(row.trait_value)) {
      resolved.set(traitKey, true);
    } else {
      resolved.delete(traitKey);
    }
  }

  for (const row of cardTraitKvs) {
    if (row.slot_kind !== slotKind) continue;
    if (!BASE_TRAIT_KEYS.includes(row.trait_key)) continue;

    if (toTraitBool(row.trait_value)) {
      resolved.set(row.trait_key, true);
    } else {
      resolved.delete(row.trait_key);
    }
  }

  return resolved;
}

function parsePlayerTagFromTrendPath(path, suffix) {
  const prefix = "/api/trend/";

  const raw = path.slice(prefix.length, path.length - suffix.length);
  const decoded = decodeURIComponent(raw || "").trim();
  if (!decoded) throw new Error("player_tag required");

  return normalizeTagForDb(decoded);
}

export async function handleTrendTraits(env, url, path) {
  const playerTagDb = parsePlayerTagFromTrendPath(path, "/traits");
  const seasons = clampInt(url.searchParams.get("seasons"), 1, 6, 2);

  const since = await findSeasonLowerBound(env, seasons);

  const totalRow = await env.DB.prepare(
    `
    SELECT COUNT(*) AS total_battles
    FROM battles
    WHERE player_tag = ?
      AND (? IS NULL OR battle_time >= ?);
    `
  ).bind(playerTagDb, since, since).all();

  const totalBattles = Number(totalRow.results?.[0]?.total_battles) || 0;

  const traitRows = await env.DB.prepare(
    `
    SELECT trait_key
    FROM trait_keys
    ORDER BY trait_key ASC;
    `
  ).all();

  const traitKeys = [...BASE_TRAIT_KEYS];
  for (const row of traitRows.results || []) {
    if (!row?.trait_key) continue;
    if (!traitKeys.includes(row.trait_key)) traitKeys.push(row.trait_key);
  }

  if (totalBattles === 0) {
    return json({
      ok: true,
      filter: { seasons },
      total_battles: 0,
      deck_size: 9,
      traits: traitKeys.map((traitKey) => ({
        trait_key: traitKey,
        distribution: [],
        summary: { mean_count: 0, rate_ge_2: 0 },
      })),
    });
  }

  const cardRows = await env.DB.prepare(
    `
    SELECT
      b.battle_id,
      boc.card_id,
      boc.slot_kind
    FROM battles b
    LEFT JOIN battle_opponent_cards boc
      ON boc.battle_id = b.battle_id
    WHERE b.player_tag = ?
      AND (? IS NULL OR b.battle_time >= ?)
    ORDER BY b.battle_id ASC, boc.slot ASC;
    `
  ).bind(playerTagDb, since, since).all();

  const cardTraitsById = new Map();
  const cardTraitKvsById = new Map();

  const baseRows = await env.DB.prepare(
    `
    SELECT
      card_id,
      card_type,
      is_air,
      can_damage_air,
      primary_target_buildings,
      is_aoe,
      is_swarm_like
    FROM card_traits;
    `
  ).all();

  const kvRows = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind,
      trait_key,
      trait_value
    FROM card_trait_kv;
    `
  ).all();

  for (const row of baseRows.results || []) {
    cardTraitsById.set(row.card_id, row);
  }
  for (const row of kvRows.results || []) {
    if (!cardTraitKvsById.has(row.card_id)) cardTraitKvsById.set(row.card_id, []);
    cardTraitKvsById.get(row.card_id).push(row);
  }

  const distributionByTrait = new Map();
  const sumByTrait = new Map();
  const ge2ByTrait = new Map();
  for (const traitKey of traitKeys) {
    distributionByTrait.set(traitKey, new Map());
    sumByTrait.set(traitKey, 0);
    ge2ByTrait.set(traitKey, 0);
  }

  const emptyCounts = new Map(traitKeys.map((traitKey) => [traitKey, 0]));

  let currentBattleId = null;
  let currentCounts = new Map(emptyCounts);

  const flushBattle = () => {
    if (!currentBattleId) return;
    for (const traitKey of traitKeys) {
      const count = currentCounts.get(traitKey) || 0;
      const dist = distributionByTrait.get(traitKey);
      dist.set(count, (dist.get(count) || 0) + 1);
      sumByTrait.set(traitKey, (sumByTrait.get(traitKey) || 0) + count);
      if (count >= 2) ge2ByTrait.set(traitKey, (ge2ByTrait.get(traitKey) || 0) + 1);
    }
  };

  for (const row of cardRows.results || []) {
    if (row.battle_id !== currentBattleId) {
      flushBattle();
      currentBattleId = row.battle_id;
      currentCounts = new Map(emptyCounts);
    }

    if (!Number.isInteger(row.card_id)) continue;

    const resolvedTraits = resolveCardTraits(
      cardTraitsById.get(row.card_id),
      cardTraitKvsById.get(row.card_id) || [],
      row.slot_kind
    );

    for (const traitKey of resolvedTraits.keys()) {
      if (!distributionByTrait.has(traitKey)) continue;
      currentCounts.set(traitKey, (currentCounts.get(traitKey) || 0) + 1);
    }
  }

  flushBattle();

  const traits = traitKeys.map((traitKey) => {
    const dist = distributionByTrait.get(traitKey) || new Map();
    const distribution = Array.from(dist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([count, battles]) => ({
        count,
        battles,
        rate: battles / totalBattles,
      }));

    return {
      trait_key: traitKey,
      distribution,
      summary: {
        mean_count: (sumByTrait.get(traitKey) || 0) / totalBattles,
        rate_ge_2: (ge2ByTrait.get(traitKey) || 0) / totalBattles,
      },
    };
  });

  return json({
    ok: true,
    filter: { seasons },
    total_battles: totalBattles,
    deck_size: 9,
    traits,
  });
}

export async function handleTrendWinConditions(env, url, path) {
  const playerTagDb = parsePlayerTagFromTrendPath(path, "/win-conditions");
  const seasons = clampInt(url.searchParams.get("seasons"), 1, 6, 2);
  const since = await findSeasonLowerBound(env, seasons);

  const totals = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ?
        AND result IN ('win','loss')
        AND (? IS NULL OR battle_time >= ?)
    ),
    battle_counts AS (
      SELECT
        r.battle_id,
        COUNT(cc.card_id) AS win_count
      FROM recent r
      LEFT JOIN battle_opponent_cards boc ON boc.battle_id = r.battle_id
      LEFT JOIN card_classes cc
        ON cc.card_id = boc.card_id
        AND cc.class_key = 'win_condition'
      GROUP BY r.battle_id
    ),
    total AS (SELECT COUNT(*) AS total_points FROM recent),
    no_win AS (
      SELECT COUNT(*) AS no_win_condition_points
      FROM battle_counts
      WHERE win_count = 0
    )
    SELECT
      (SELECT total_points FROM total) AS total_points,
      (SELECT no_win_condition_points FROM no_win) AS no_win_condition_points;
    `
  )
    .bind(playerTagDb, since, since)
    .all();

  const totalRow = totals.results?.[0] || {};
  const totalPoints = Number(totalRow.total_points) || 0;
  const noWinConditionPoints = Number(totalRow.no_win_condition_points) || 0;

  if (totalPoints === 0) {
    return json({
      ok: true,
      filter: { seasons },
      no_win_condition_points: 0,
      total_points: 0,
      cards: [],
    });
  }

  const cardsResult = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ?
        AND result IN ('win','loss')
        AND (? IS NULL OR battle_time >= ?)
    ),
    win_cards AS (
      SELECT
        boc.battle_id,
        boc.card_id,
        boc.slot_kind
      FROM battle_opponent_cards boc
      JOIN recent r ON r.battle_id = boc.battle_id
      JOIN card_classes cc
        ON cc.card_id = boc.card_id
        AND cc.class_key = 'win_condition'
    ),
    battle_counts AS (
      SELECT r.battle_id, COUNT(wc.card_id) AS win_count
      FROM recent r
      LEFT JOIN win_cards wc ON wc.battle_id = r.battle_id
      GROUP BY r.battle_id
    )
    SELECT
      wc.card_id,
      wc.slot_kind,
      SUM(1.0 / bc.win_count) AS fractional_points
    FROM win_cards wc
    JOIN battle_counts bc ON bc.battle_id = wc.battle_id
    WHERE bc.win_count > 0
    GROUP BY wc.card_id, wc.slot_kind
    ORDER BY fractional_points DESC;
    `
  )
    .bind(playerTagDb, since, since)
    .all();

  return json({
    ok: true,
    filter: { seasons },
    no_win_condition_points: noWinConditionPoints,
    total_points: totalPoints,
    cards: cardsResult.results || [],
  });
}
