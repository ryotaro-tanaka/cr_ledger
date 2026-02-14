import { clampInt, json } from "../http.js";
import {
  findAllCardTraitKvs,
  findAllCardTraits,
  findBattleOpponentCardsForDeck,
  findCardClassesByCardIds,
  findCardTraitKeysByCardIds,
  findCardTraitsByCardIds,
  findDeckBattleSummary,
  findDeckCards,
  findDeckCardsWithSlot,
  findDeckWinConditionCards,
  findDefenseThreats,
  findOffenseCardCounters,
  findRecentSeasonStartTimes,
  findTraitDescriptions,
} from "../db/decks.js";

const TRAIT_FIELDS = [
  "is_air",
  "can_damage_air",
  "primary_target_buildings",
  "is_aoe",
  "is_swarm_like",
];

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

function buildCounterStats(totalBattles, baselineWinRate, battlesWithElement, winsWithElement) {
  const encounterRate = totalBattles > 0 ? battlesWithElement / totalBattles : 0;
  const winRateGiven = battlesWithElement > 0 ? winsWithElement / battlesWithElement : 0;
  const deltaVsBaseline = winRateGiven - baselineWinRate;
  const threatScore = encounterRate * Math.max(0, baselineWinRate - winRateGiven);

  return {
    battles_with_element: battlesWithElement,
    encounter_rate: encounterRate,
    win_rate_given: winRateGiven,
    delta_vs_baseline: deltaVsBaseline,
    threat_score: threatScore,
  };
}

function sortCounterRows(a, b) {
  if (b.stats.threat_score !== a.stats.threat_score) {
    return b.stats.threat_score - a.stats.threat_score;
  }
  if (a.stats.delta_vs_baseline !== b.stats.delta_vs_baseline) {
    return a.stats.delta_vs_baseline - b.stats.delta_vs_baseline;
  }
  if (b.stats.battles_with_element !== a.stats.battles_with_element) {
    return b.stats.battles_with_element - a.stats.battles_with_element;
  }
  return 0;
}

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

  const cards = await findDeckCards(env, myDeckKey);
  if (cards.length === 0) {
    return json({ ok: true, deck_traits: [], deck_classes: [], cards: [] }, 200);
  }

  const cardIds = [...new Set(cards.map((card) => card.card_id))];
  const cardTraits = await findCardTraitsByCardIds(env, cardIds);
  const traitKvs = await findCardTraitKeysByCardIds(env, cardIds);
  const classes = await findCardClassesByCardIds(env, cardIds);

  const cardTraitsById = new Map(cardTraits.map((row) => [row.card_id, row]));

  const traitKvById = new Map();
  for (const row of traitKvs) {
    if (!traitKvById.has(row.card_id)) traitKvById.set(row.card_id, []);
    traitKvById.get(row.card_id).push(row);
  }

  const classesById = new Map();
  for (const row of classes) {
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

export async function handleDeckOffenseCounters(env, url, path) {
  const prefix = "/api/decks/";
  const suffix = "/offense/counters";

  const raw = path.slice(prefix.length, path.length - suffix.length);

  let decoded;
  try {
    decoded = decodeURIComponent(raw || "").trim();
  } catch {
    return json({ ok: false, error: "invalid my_deck_key" }, 400);
  }

  if (!decoded) return json({ ok: false, error: "my_deck_key required" }, 400);

  const seasons = clampInt(url.searchParams.get("seasons"), 1, 6, 2);

  const deckCards = await findDeckCardsWithSlot(env, decoded);
  if (deckCards.length === 0) {
    return json({ ok: false, error: "deck not found" }, 404);
  }

  const winConditionCards = (await findDeckWinConditionCards(env, decoded)).map((row) => ({
    card_id: row.card_id,
    slot_kind: row.slot_kind,
  }));

  const seasonRows = await findRecentSeasonStartTimes(env, seasons);
  const since = seasonRows.length > 0 ? seasonRows[seasonRows.length - 1].start_time : null;

  if (winConditionCards.length === 0) {
    return json({
      ok: true,
      filter: { seasons },
      summary: {
        total_battles: 0,
        baseline_win_rate: 0,
        win_condition_cards: [],
      },
      counters: {
        cards: [],
        traits: [],
      },
    });
  }

  const summary = await findDeckBattleSummary(env, decoded, since);
  const totalBattles = Number(summary?.total_battles) || 0;
  const baselineWinRate = Number(summary?.baseline_win_rate) || 0;

  if (totalBattles === 0) {
    return json({
      ok: true,
      filter: { seasons },
      summary: {
        total_battles: 0,
        baseline_win_rate: 0,
        win_condition_cards: winConditionCards,
      },
      counters: {
        cards: [],
        traits: [],
      },
    });
  }

  const cardCounters = (await findOffenseCardCounters(env, decoded, since))
    .map((row) => ({
      card_id: row.card_id,
      slot_kind: row.slot_kind,
      stats: buildCounterStats(
        totalBattles,
        baselineWinRate,
        Number(row.battles_with_element) || 0,
        Number(row.wins_with_element) || 0
      ),
    }))
    .sort(sortCounterRows);

  const battleCardRows = await findBattleOpponentCardsForDeck(env, decoded, since);
  const allCardTraits = await findAllCardTraits(env);
  const allCardTraitKvs = await findAllCardTraitKvs(env);
  const traitDescriptionsRows = await findTraitDescriptions(env);

  const cardTraitsById = new Map(allCardTraits.map((row) => [row.card_id, row]));

  const cardTraitKvsById = new Map();
  for (const row of allCardTraitKvs) {
    if (!cardTraitKvsById.has(row.card_id)) cardTraitKvsById.set(row.card_id, []);
    cardTraitKvsById.get(row.card_id).push(row);
  }

  const traitDescriptions = new Map(traitDescriptionsRows.map((row) => [row.trait_key, row.description]));

  const battleResultById = new Map();
  const traitsByBattle = new Map();

  for (const row of battleCardRows) {
    battleResultById.set(row.battle_id, row.result);

    if (!traitsByBattle.has(row.battle_id)) {
      traitsByBattle.set(row.battle_id, new Set());
    }

    const resolvedTraits = resolveCardTraits(
      cardTraitsById.get(row.card_id),
      cardTraitKvsById.get(row.card_id) || [],
      row.slot_kind
    );

    const traitSet = traitsByBattle.get(row.battle_id);
    for (const traitKey of resolvedTraits.keys()) {
      traitSet.add(traitKey);
    }
  }

  const traitAgg = new Map();
  for (const [battleId, traitSet] of traitsByBattle.entries()) {
    const result = battleResultById.get(battleId);
    const won = result === "win" ? 1 : 0;

    for (const traitKey of traitSet) {
      if (!traitAgg.has(traitKey)) {
        traitAgg.set(traitKey, { battles: 0, wins: 0 });
      }
      const entry = traitAgg.get(traitKey);
      entry.battles += 1;
      entry.wins += won;
    }
  }

  const traitCounters = Array.from(traitAgg.entries())
    .map(([traitKey, agg]) => ({
      trait_key: traitKey,
      description: traitDescriptions.get(traitKey) ?? null,
      stats: buildCounterStats(totalBattles, baselineWinRate, agg.battles, agg.wins),
    }))
    .sort(sortCounterRows);

  return json({
    ok: true,
    filter: { seasons },
    summary: {
      total_battles: totalBattles,
      baseline_win_rate: baselineWinRate,
      win_condition_cards: winConditionCards,
    },
    counters: {
      cards: cardCounters,
      traits: traitCounters,
    },
  });
}

export async function handleDeckDefenseThreats(env, url, path) {
  const prefix = "/api/decks/";
  const suffix = "/defense/threats";

  const raw = path.slice(prefix.length, path.length - suffix.length);

  let decoded;
  try {
    decoded = decodeURIComponent(raw || "").trim();
  } catch {
    return json({ ok: false, error: "invalid my_deck_key" }, 400);
  }

  if (!decoded) return json({ ok: false, error: "my_deck_key required" }, 400);

  const seasons = clampInt(url.searchParams.get("seasons"), 1, 6, 2);

  const deckCards = await findDeckCards(env, decoded);
  if (deckCards.length === 0) {
    return json({ ok: false, error: "deck not found" }, 404);
  }

  const seasonRows = await findRecentSeasonStartTimes(env, seasons);
  const since = seasonRows.length > 0 ? seasonRows[seasonRows.length - 1].start_time : null;

  const summary = await findDeckBattleSummary(env, decoded, since);
  const totalBattles = Number(summary?.total_battles) || 0;
  const baselineWinRate = Number(summary?.baseline_win_rate) || 0;

  if (totalBattles === 0) {
    return json({
      ok: true,
      filter: { seasons },
      summary: {
        total_battles: 0,
        baseline_win_rate: 0,
      },
      threats: [],
    });
  }

  const threats = (await findDefenseThreats(env, decoded, since))
    .map((row) => ({
      card_id: row.card_id,
      slot_kind: row.slot_kind,
      stats: buildCounterStats(
        totalBattles,
        baselineWinRate,
        Number(row.battles_with_element) || 0,
        Number(row.wins_with_element) || 0
      ),
    }))
    .sort(sortCounterRows);

  return json({
    ok: true,
    filter: { seasons },
    summary: {
      total_battles: totalBattles,
      baseline_win_rate: baselineWinRate,
    },
    threats,
  });
}
