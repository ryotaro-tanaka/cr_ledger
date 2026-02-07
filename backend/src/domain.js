/** ---------- Tag / Mode ---------- */

/**
 * API用のプレイヤータグへ正規化する（"#" を必ず付ける）
 * 例: "GYVC..." -> "#GYVC..."
 */
export function normalizeTagForApi(tag) {
  const t = (tag || "").trim().toUpperCase();
  return t.startsWith("#") ? t : `#${t}`;
}

/**
 * DB/ID用のプレイヤータグへ正規化する（"#" を外す）
 * 例: "#GYVC..." -> "GYVC..."
 */
export function normalizeTagForDb(tag) {
  const t = (tag || "").trim().toUpperCase();
  return t.startsWith("#") ? t.slice(1) : t;
}

/**
 * 対象モード判定（厳密条件）
 */
export function isTargetMode(gameModeName) {
  return (
    gameModeName === "Ladder" ||
    (typeof gameModeName === "string" && gameModeName.startsWith("Ranked1v1_"))
  );
}

/**
 * battlelog の type は将来欠ける可能性があるので "unknown" に丸める
 */
export function normalizeType(type) {
  return typeof type === "string" && type.length > 0 ? type : "unknown";
}

/** ---------- slot_kind (temporary assumption) ---------- */
/**
 * 仮定（後で差し替え前提）:
 * - evolutionLevel: 1 => evolution
 * - evolutionLevel: 2 => hero
 * - 無い/その他      => normal
 */
export function cardSlotKindFromBattlelog(card) {
  const ev = card?.evolutionLevel;
  if (ev === 1) return "evolution";
  if (ev === 2) return "hero";
  return "normal";
}

/** ---------- deck key ---------- */
/**
 * デッキ識別子（順序不問のカノニカルキー） + player_tag prefix
 *
 * 仕様（確定）:
 *   my_deck_key := "{player_tag_db}::{canonical_deck}"
 *
 * canonical_deck:
 * - 8枚のメインカード + support(必ず1枚) を対象
 * - "card_id:slot_kind" を作り、card_id 昇順にソートして "|" で連結
 *
 * 例:
 *   GYVCJJCR0::26000010:normal|...|159000000:support
 */
export function makeDeckKeySortedWithKindAndSupport(playerTagDb, myCards, mySupportCard) {
  const pt = (playerTagDb || "").trim().toUpperCase();
  if (!pt) return null;
  if (!Array.isArray(myCards)) return null;

  const main = myCards
    .map((c) => {
      const id = c?.id;
      if (!Number.isInteger(id)) return null;
      return { card_id: id, slot_kind: cardSlotKindFromBattlelog(c) };
    })
    .filter(Boolean);

  if (main.length !== 8) return null;

  // support は必ず slot 8 で保存する前提だが、battlelog上は欠ける可能性もあるので null を許容
  const supportId = mySupportCard && Number.isInteger(mySupportCard.id) ? mySupportCard.id : null;

  const all = [
    ...main,
    ...(supportId ? [{ card_id: supportId, slot_kind: "support" }] : []),
  ];

  // 念のため9枚（supportあり）を推奨。無いときもDB保存は許可するが、キーの一意性が変わるので気付けるよう null を返す選択肢もある。
  if (all.length !== 9) return null;

  all.sort((a, b) => a.card_id - b.card_id);

  const canonical = all.map((x) => `${x.card_id}:${x.slot_kind}`).join("|");
  return `${pt}::${canonical}`;
}

/** ---------- battle id ---------- */
/**
 * battle_id 仕様（#なしタグ）
 */
export function makeBattleId({ myTagDb, opTagDb, battleTime, type }) {
  return `${myTagDb}_${opTagDb}_${battleTime}_${type}`;
}

/** ---------- result judge (confirmed rules) ---------- */
function toPrincessArr(v) {
  return Array.isArray(v) ? v.filter((x) => Number.isFinite(x)) : [];
}
function toHp(v) {
  return Number.isFinite(v) ? v : 0;
}

/**
 * 勝敗判定ルール（確定版）
 * return: "win" | "loss" | "draw"
 */
export function judgeResultFromBattlelog(my, op) {
  const myKing = toHp(my?.kingTowerHitPoints);
  const opKing = toHp(op?.kingTowerHitPoints);

  const myPrincessArr = toPrincessArr(my?.princessTowersHitPoints);
  const opPrincessArr = toPrincessArr(op?.princessTowersHitPoints);

  const myPrincessCount = myPrincessArr.length;
  const opPrincessCount = opPrincessArr.length;

  const myAll = [myKing, ...myPrincessArr];
  const opAll = [opKing, ...opPrincessArr];

  const myMin = Math.min(...myAll);
  const opMin = Math.min(...opAll);

  // 1) king 0 rule
  if (myKing === 0 && opKing > 0) return "loss";
  if (opKing === 0 && myKing > 0) return "win";
  if (myKing === 0 && opKing === 0) return "draw";

  // 2) princess remaining count
  if (myPrincessCount < opPrincessCount) return "loss";
  if (opPrincessCount < myPrincessCount) return "win";

  // 3) tie-break by min tower hp
  if (myMin < opMin) return "loss";
  if (opMin < myMin) return "win";

  return "draw";
}

export function toIntOrNull(v) {
  return Number.isInteger(v) ? v : null;
}
