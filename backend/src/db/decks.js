/**
 * Deck関連のD1読み取り。
 */

function toResults(r) {
  return r.results || [];
}

export async function findDeckCards(env, myDeckKey) {
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind
    FROM my_deck_cards
    WHERE my_deck_key = ?
    ORDER BY slot ASC;
    `
  ).bind(myDeckKey).all();

  return toResults(r);
}

export async function findDeckCardsWithSlot(env, myDeckKey) {
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind,
      slot
    FROM my_deck_cards
    WHERE my_deck_key = ?
    ORDER BY slot ASC;
    `
  ).bind(myDeckKey).all();

  return toResults(r);
}

export async function findCardTraitsByCardIds(env, cardIds) {
  const placeholders = cardIds.map(() => "?").join(",");
  const r = await env.DB.prepare(
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

  return toResults(r);
}

export async function findCardTraitKeysByCardIds(env, cardIds) {
  const placeholders = cardIds.map(() => "?").join(",");
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind,
      trait_key
    FROM card_trait_kv
    WHERE card_id IN (${placeholders});
    `
  ).bind(...cardIds).all();

  return toResults(r);
}

export async function findCardClassesByCardIds(env, cardIds) {
  const placeholders = cardIds.map(() => "?").join(",");
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      class_key
    FROM card_classes
    WHERE card_id IN (${placeholders});
    `
  ).bind(...cardIds).all();

  return toResults(r);
}

export async function findDeckWinConditionCards(env, myDeckKey) {
  const r = await env.DB.prepare(
    `
    SELECT
      mdc.card_id,
      mdc.slot_kind,
      mdc.slot
    FROM my_deck_cards mdc
    JOIN card_classes cc
      ON cc.card_id = mdc.card_id
      AND cc.class_key = 'win_condition'
    WHERE mdc.my_deck_key = ?
    ORDER BY mdc.slot ASC;
    `
  ).bind(myDeckKey).all();

  return toResults(r);
}

export async function findRecentSeasonStartTimes(env, seasons) {
  const r = await env.DB.prepare(
    `
    SELECT start_time
    FROM seasons
    ORDER BY start_time DESC
    LIMIT ?;
    `
  ).bind(seasons).all();

  return toResults(r);
}

export async function findDeckBattleSummary(env, myDeckKey, since) {
  const r = await env.DB.prepare(
    `
    SELECT
      COUNT(*) AS total_battles,
      AVG(CASE WHEN result = 'win' THEN 1.0 ELSE 0.0 END) AS baseline_win_rate
    FROM battles
    WHERE my_deck_key = ?
      AND result IN ('win','loss')
      AND (? IS NULL OR battle_time >= ?);
    `
  ).bind(myDeckKey, since, since).all();

  return toResults(r)[0] || null;
}

export async function findOffenseCardCounters(env, myDeckKey, since) {
  const r = await env.DB.prepare(
    `
    WITH target_battles AS (
      SELECT battle_id, result
      FROM battles
      WHERE my_deck_key = ?
        AND result IN ('win','loss')
        AND (? IS NULL OR battle_time >= ?)
    ),
    card_per_battle AS (
      SELECT
        boc.card_id,
        boc.slot_kind,
        tb.battle_id,
        tb.result
      FROM target_battles tb
      JOIN battle_opponent_cards boc ON boc.battle_id = tb.battle_id
    )
    SELECT
      card_id,
      slot_kind,
      COUNT(*) AS battles_with_element,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins_with_element
    FROM card_per_battle
    GROUP BY card_id, slot_kind;
    `
  ).bind(myDeckKey, since, since).all();

  return toResults(r);
}

export async function findBattleOpponentCardsForDeck(env, myDeckKey, since) {
  const r = await env.DB.prepare(
    `
    WITH target_battles AS (
      SELECT battle_id, result
      FROM battles
      WHERE my_deck_key = ?
        AND result IN ('win','loss')
        AND (? IS NULL OR battle_time >= ?)
    )
    SELECT
      tb.battle_id,
      tb.result,
      boc.card_id,
      boc.slot_kind
    FROM target_battles tb
    JOIN battle_opponent_cards boc ON boc.battle_id = tb.battle_id
    ORDER BY tb.battle_id ASC, boc.slot ASC;
    `
  ).bind(myDeckKey, since, since).all();

  return toResults(r);
}

export async function findAllCardTraits(env) {
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      is_air,
      can_damage_air,
      primary_target_buildings,
      is_aoe,
      is_swarm_like
    FROM card_traits;
    `
  ).all();

  return toResults(r);
}

export async function findAllCardTraitKvs(env) {
  const r = await env.DB.prepare(
    `
    SELECT
      card_id,
      slot_kind,
      trait_key,
      trait_value
    FROM card_trait_kv;
    `
  ).all();

  return toResults(r);
}

export async function findTraitDescriptions(env) {
  const r = await env.DB.prepare(
    `
    SELECT
      trait_key,
      description
    FROM trait_keys;
    `
  ).all();

  return toResults(r);
}

export async function findDefenseThreats(env, myDeckKey, since) {
  const r = await env.DB.prepare(
    `
    WITH target_battles AS (
      SELECT battle_id, result
      FROM battles
      WHERE my_deck_key = ?
        AND result IN ('win','loss')
        AND (? IS NULL OR battle_time >= ?)
    ),
    opponent_win_condition_cards AS (
      SELECT
        tb.battle_id,
        tb.result,
        boc.card_id,
        boc.slot_kind
      FROM target_battles tb
      JOIN battle_opponent_cards boc
        ON boc.battle_id = tb.battle_id
      JOIN card_classes cc
        ON cc.card_id = boc.card_id
        AND cc.class_key = 'win_condition'
      GROUP BY
        tb.battle_id,
        tb.result,
        boc.card_id,
        boc.slot_kind
    )
    SELECT
      card_id,
      slot_kind,
      COUNT(*) AS battles_with_element,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins_with_element
    FROM opponent_win_condition_cards
    GROUP BY card_id, slot_kind;
    `
  ).bind(myDeckKey, since, since).all();

  return toResults(r);
}



export async function statsMyDecksSeasons(env, playerTagDb, since) {
  const sinceNormalized = since ? String(since).replaceAll('-', '').replaceAll(':', '') : null;

  const totalResult = await env.DB.prepare(
    `
    SELECT COUNT(*) AS total_battles
    FROM battles
    WHERE player_tag = ?
      AND result IN ('win','loss')
      AND (
        ? IS NULL
        OR REPLACE(REPLACE(battle_time, '-', ''), ':', '') >= ?
      );
    `
  ).bind(playerTagDb, sinceNormalized, sinceNormalized).all();

  const total = Number(totalResult.results?.[0]?.total_battles ?? 0);
  if (total === 0) return { total_battles: 0, decks: [] };

  const r = await env.DB.prepare(
    `
    SELECT
      b.my_deck_key,
      d.deck_name,
      COUNT(*) AS battles
    FROM battles b
    LEFT JOIN my_decks d ON d.my_deck_key = b.my_deck_key
    WHERE b.player_tag = ?
      AND b.result IN ('win','loss')
      AND (
        ? IS NULL
        OR REPLACE(REPLACE(b.battle_time, '-', ''), ':', '') >= ?
      )
    GROUP BY b.my_deck_key, d.deck_name
    ORDER BY battles DESC;
    `
  ).bind(playerTagDb, sinceNormalized, sinceNormalized).all();

  return { total_battles: total, decks: r.results || [] };
}

export async function findSeasonLowerBound(env, seasons) {
  const normalizeSeasonTime = (value) => {
    if (value === null || value === undefined) return null;
    return String(value).replaceAll('-', '').replaceAll(':', '');
  };

  const r = await env.DB.prepare(
    `
    SELECT start_time
    FROM seasons;
    `
  ).all();

  const normalized = (r.results || [])
    .map((row) => normalizeSeasonTime(row.start_time))
    .filter((value) => value);

  if (normalized.length === 0) return null;

  const recent = normalized.sort((a, b) => b.localeCompare(a)).slice(0, seasons);
  if (recent.length === 0) return null;

  return recent.reduce((min, current) => (current < min ? current : min), recent[0]);
}
