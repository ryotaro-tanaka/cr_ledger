import { clampInt, json } from "../http.js";
import { requirePlayerTagDb } from "../params.js";

export async function handleTrendWinConditions(env, url) {
  const playerTagDb = requirePlayerTagDb(url);
  const last = clampInt(url.searchParams.get("last"), 1, 5000, 200);

  const totals = await env.DB.prepare(
    `
    WITH recent AS (
      SELECT battle_id
      FROM battles
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
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
    .bind(playerTagDb, last)
    .all();

  const totalRow = totals.results?.[0] || {};
  const totalPoints = Number(totalRow.total_points) || 0;
  const noWinConditionPoints = Number(totalRow.no_win_condition_points) || 0;

  if (totalPoints === 0) {
    return json({
      ok: true,
      filter: { last },
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
      WHERE player_tag = ? AND result IN ('win','loss')
      ORDER BY battle_time DESC
      LIMIT ?
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
    .bind(playerTagDb, last)
    .all();

  return json({
    ok: true,
    filter: { last },
    no_win_condition_points: noWinConditionPoints,
    total_points: totalPoints,
    cards: cardsResult.results || [],
  });
}
