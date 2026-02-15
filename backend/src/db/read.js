/**
 * D1操作をまとめる層（read）。
 */

/** ---------- existence ---------- */

export async function battleExists(env, battleId) {
  const r = await env.DB.prepare(
    `SELECT 1 AS one FROM battles WHERE battle_id = ? LIMIT 1`
  ).bind(battleId).all();

  return (r.results?.length || 0) > 0;
}

/** ---------- read: players/decks ---------- */

export async function listPlayers(env, firstPlayerTagDb = "GYVCJJCR0") {
  const r = await env.DB.prepare(
    `
    SELECT player_tag, player_name
    FROM players
    ORDER BY
      CASE WHEN player_tag = ? THEN 0 ELSE 1 END,
      player_tag ASC;
    `
  ).bind(firstPlayerTagDb).all();

  return { players: r.results || [] };
}

export async function updateDeckName(env, myDeckKey, deckNameOrNull) {
  const r = await env.DB.prepare(`
    UPDATE my_decks
    SET deck_name = ?
    WHERE my_deck_key = ?
  `).bind(deckNameOrNull, myDeckKey).run();

  const changes = r?.meta?.changes ?? r?.changes ?? 0;
  return { changes };
}

export async function getMyDeckCards(env, myDeckKey) {
  const r = await env.DB.prepare(
    `
    SELECT
      slot,
      card_id,
      slot_kind
    FROM my_deck_cards
    WHERE my_deck_key = ?
    ORDER BY slot ASC;
    `
  ).bind(myDeckKey).all();

  return { cards: r.results || [] };
}


export async function listCardClasses(env) {
  const r = await env.DB.prepare(
    `
    SELECT
      class_key,
      card_id
    FROM card_classes
    ORDER BY class_key ASC, card_id ASC;
    `
  ).all();

  return { classes: r.results || [] };
}

export async function listCardTraits(env) {
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
    FROM card_traits;
    `
  ).all();

  return { traits: r.results || [] };
}

export async function listCardTraitKvs(env) {
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

  return { trait_kvs: r.results || [] };
}
