/**
 * 既存の集計SQL（legacy APIs）。
 */

/** ---------- stats helpers ---------- */

async function oneNumber(env, sql, binds = []) {
  const r = await env.DB.prepare(sql).bind(...binds).all();
  const row = r.results?.[0];
  if (!row) return 0;
  const v = Object.values(row)[0];
  return Number.isFinite(v) ? v : 0;
}

/** ---------- stats: opponent trend (filtered by player_tag) ---------- */

/**
 * 直近 last 件（win/lossのみ）における相手カード使用率（player_tagで絞る）
 */
export async function statsOpponentTrendLast(env, playerTagDb, last) {
  const total = await oneNumber(
    env,
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    )
    SELECT COUNT(*) AS total_battles FROM recent;
    `,
    [playerTagDb, last]
  );

  if (total === 0) return { total_battles: 0, cards: [] };

  const r = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    ),
    total AS (SELECT COUNT(*) AS total_battles FROM recent)
    SELECT
      boc.card_id,
      boc.slot_kind,
      COUNT(DISTINCT boc.battle_id) AS battles,
      (COUNT(DISTINCT boc.battle_id) * 1.0) / (SELECT total_battles FROM total) AS usage_rate
    FROM battle_opponent_cards boc
    JOIN recent r ON r.battle_id = boc.battle_id
    GROUP BY boc.card_id, boc.slot_kind
    ORDER BY battles DESC;
    `
  ).bind(playerTagDb, last).all();

  return { total_battles: total, cards: r.results };
}

/**
 * battle_time >= since（win/lossのみ）における相手カード使用率（player_tagで絞る）
 */
export async function statsOpponentTrendSince(env, playerTagDb, since) {
  const total = await oneNumber(
    env,
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss') AND battle_time >= ?
    )
    SELECT COUNT(*) AS total_battles FROM recent;
    `,
    [playerTagDb, since]
  );

  if (total === 0) return { total_battles: 0, cards: [] };

  const r = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss') AND battle_time >= ?
    ),
    total AS (SELECT COUNT(*) AS total_battles FROM recent)
    SELECT
      boc.card_id,
      boc.slot_kind,
      COUNT(DISTINCT boc.battle_id) AS battles,
      (COUNT(DISTINCT boc.battle_id) * 1.0) / (SELECT total_battles FROM total) AS usage_rate
    FROM battle_opponent_cards boc
    JOIN recent r ON r.battle_id = boc.battle_id
    GROUP BY boc.card_id, boc.slot_kind
    ORDER BY battles DESC;
    `
  ).bind(playerTagDb, since).all();

  return { total_battles: total, cards: r.results };
}

/** ---------- stats: matchup by card (for a deck) ---------- */
export async function statsMatchupByCardLast(env, myDeckKey, last) {
  const total = await oneNumber(
    env,
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE my_deck_key = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    )
    SELECT COUNT(*) AS total_battles FROM recent;
    `,
    [myDeckKey, last]
  );

  if (total === 0) return { total_battles: 0, cards: [] };

  const r = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id, result
      FROM battles
      WHERE my_deck_key = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    ),
    per_card AS (
      SELECT
        boc.card_id,
        boc.slot_kind,
        COUNT(DISTINCT boc.battle_id) AS battles,
        SUM(CASE WHEN r.result = 'win'  THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN r.result = 'loss' THEN 1 ELSE 0 END) AS losses
      FROM battle_opponent_cards boc
      JOIN recent r ON r.battle_id = boc.battle_id
      GROUP BY boc.card_id, boc.slot_kind
    )
    SELECT
      card_id,
      slot_kind,
      battles,
      wins,
      losses,
      CASE
        WHEN battles > 0 THEN (wins * 1.0) / battles
        ELSE 0
      END AS win_rate
    FROM per_card
    ORDER BY win_rate ASC, battles DESC;
    `
  ).bind(myDeckKey, last).all();

  return { total_battles: total, cards: r.results };
}

/** ---------- stats: priority (trend(player) × weakness(deck)) ---------- */
/**
 * 目的:
 * - trend: 「特定のプレイヤー」が最近よく当たるカード（usage_rate）
 * - weakness: 「特定のデッキ」がそのカード相手に勝てているか（win_rate）
 *
 * 出力:
 * - trend側に存在するカードをベースに返す（よく当たるカード一覧）
 * - weaknessデータが十分(min)ある場合のみ priority_score を計算
 *
 * priority_score = usage_rate * (1 - win_rate)
 */
export async function statsPriorityLast(env, playerTagDb, myDeckKey, last) {
  const totalTrend = await oneNumber(
    env,
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    )
    SELECT COUNT(*) AS total_battles FROM recent;
    `,
    [playerTagDb, last]
  );

  if (totalTrend === 0) return { total_battles: 0, cards: [] };

  const r = await env.DB.prepare(
    `
    WITH
    -- trend: player の最近試合
    trend_recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    ),
    trend_total AS (
      SELECT COUNT(*) AS total_battles FROM trend_recent
    ),
    trend_per_card AS (
      SELECT
        boc.card_id,
        boc.slot_kind,
        COUNT(DISTINCT boc.battle_id) AS battles_with_card,
        (COUNT(DISTINCT boc.battle_id) * 1.0) / (SELECT total_battles FROM trend_total) AS usage_rate
      FROM battle_opponent_cards boc
      JOIN trend_recent t ON t.battle_id = boc.battle_id
      GROUP BY boc.card_id, boc.slot_kind
    ),

    -- weakness: deck の最近試合（このデッキでの勝率）
    deck_recent AS (
      SELECT battle_id, result
      FROM battles
      WHERE my_deck_key = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    ),
    deck_per_card AS (
      SELECT
        boc.card_id,
        boc.slot_kind,
        COUNT(DISTINCT boc.battle_id) AS deck_battles_with_card,
        SUM(CASE WHEN d.result = 'win' THEN 1 ELSE 0 END) AS deck_wins
      FROM battle_opponent_cards boc
      JOIN deck_recent d ON d.battle_id = boc.battle_id
      GROUP BY boc.card_id, boc.slot_kind
    )

    SELECT
      t.card_id,
      t.slot_kind,
      t.battles_with_card,
      t.usage_rate,

      COALESCE(dp.deck_battles_with_card, 0) AS deck_battles_with_card,

      CASE
        WHEN COALESCE(dp.deck_battles_with_card, 0) > 0
          THEN (COALESCE(dp.deck_wins, 0) * 1.0) / dp.deck_battles_with_card
        ELSE 0
      END AS win_rate,

      CASE
        WHEN COALESCE(dp.deck_battles_with_card, 0) > 0
          THEN t.usage_rate * (1.0 - ((COALESCE(dp.deck_wins, 0) * 1.0) / dp.deck_battles_with_card))
        ELSE 0
      END AS priority_score

    FROM trend_per_card t
    LEFT JOIN deck_per_card dp
      ON dp.card_id = t.card_id AND dp.slot_kind = t.slot_kind

    ORDER BY
      priority_score DESC,
      t.usage_rate DESC,
      t.battles_with_card DESC;
    `
  ).bind(playerTagDb, last, myDeckKey, last).all();

  return { total_battles: totalTrend, cards: r.results || [] };
}

/** ---------- stats: my decks list (filtered by player_tag) ---------- */

export async function statsMyDecksSeasons(env, playerTagDb, since) {
  const total = await oneNumber(
    env,
    `
    SELECT COUNT(*) AS total_battles
    FROM battles
    WHERE player_tag = ?
      AND result IN ('win','loss')
      AND (? IS NULL OR battle_time >= ?);
    `,
    [playerTagDb, since, since]
  );

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
      AND (? IS NULL OR b.battle_time >= ?)
    GROUP BY b.my_deck_key, d.deck_name
    ORDER BY battles DESC;
    `
  ).bind(playerTagDb, since, since).all();

  return { total_battles: total, decks: r.results || [] };
}

export async function statsMyDecksLast(env, playerTagDb, last) {
  const total = await oneNumber(
    env,
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    )
    SELECT COUNT(*) AS total_battles FROM recent;
    `,
    [playerTagDb, last]
  );

  if (total === 0) return { total_battles: 0, decks: [] };

  const r = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT my_deck_key
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
    )
    SELECT
      r.my_deck_key,
      d.deck_name,
      COUNT(*) AS battles
    FROM recent r
    LEFT JOIN my_decks d ON d.my_deck_key = r.my_deck_key
    GROUP BY r.my_deck_key, d.deck_name
    ORDER BY battles DESC;
    `
  ).bind(playerTagDb, last).all();

  return { total_battles: total, decks: r.results };
}
