/**
 * D1操作をまとめる層（write）。
 */

/**
 * players: 自分だけ upsert（opponentは不要）
 */
export async function upsertMePlayer(env, playerTagDb, playerName) {
  await env.DB.prepare(`
    INSERT INTO players (player_tag, player_name)
    VALUES (?, ?)
    ON CONFLICT(player_tag) DO UPDATE SET
      player_name = excluded.player_name
  `).bind(playerTagDb, playerName || null).run();
}

/**
 * my_decks: 存在しないときだけ INSERT（deck_name更新禁止）
 */
export async function insertDeckIfNotExists(env, myDeckKey, playerTagDb) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO my_decks (my_deck_key, player_tag, deck_name)
    VALUES (?, ?, NULL)
  `).bind(myDeckKey, playerTagDb).run();
}

/**
 * my_deck_cards:
 * - cards(8枚) は取得順で slot 0..7
 * - support は slot 8（必須想定）
 */
export async function upsertMyDeckCardsAsFetched(env, myDeckKey, myCards, mySupportCard, cardSlotKindFromBattlelog) {
  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO my_deck_cards (my_deck_key, slot, card_id, slot_kind)
    VALUES (?, ?, ?, ?)
  `);

  const batch = [];

  for (let i = 0; i < 8; i++) {
    const c = myCards?.[i];
    if (!c || !Number.isInteger(c.id)) continue;
    batch.push(stmt.bind(myDeckKey, i, c.id, cardSlotKindFromBattlelog(c)));
  }

  if (mySupportCard && Number.isInteger(mySupportCard.id)) {
    batch.push(stmt.bind(myDeckKey, 8, mySupportCard.id, "support"));
  }

  if (batch.length) await env.DB.batch(batch);
}

/**
 * battles: battle_id 主キーで冪等保存
 */
export async function upsertBattle(env, battleId, playerTagDb, battleTime, result, myDeckKey) {
  await env.DB.prepare(`
    INSERT INTO battles (
      battle_id, player_tag, battle_time, result, my_deck_key
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(battle_id) DO UPDATE SET
      result = excluded.result,
      my_deck_key = excluded.my_deck_key
  `).bind(
    battleId, playerTagDb, battleTime, result, myDeckKey
  ).run();
}

/**
 * battle_opponent_cards:
 * - 取得順で slot 0..7
 * - support は slot 8
 */
export async function upsertOpponentCardsAsFetched(env, battleId, opCards, opSupportCard, cardSlotKindFromBattlelog) {
  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO battle_opponent_cards (battle_id, slot, card_id, slot_kind)
    VALUES (?, ?, ?, ?)
  `);

  const batch = [];

  for (let i = 0; i < 8; i++) {
    const c = opCards?.[i];
    if (!c || !Number.isInteger(c.id)) continue;
    batch.push(stmt.bind(battleId, i, c.id, cardSlotKindFromBattlelog(c)));
  }

  if (opSupportCard && Number.isInteger(opSupportCard.id)) {
    batch.push(stmt.bind(battleId, 8, opSupportCard.id, "support"));
  }

  if (batch.length) await env.DB.batch(batch);
}
