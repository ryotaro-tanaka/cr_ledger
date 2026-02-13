# Overview 判定ロジック（frontend）

本ドキュメントは `frontend/src/pages/HomePage.tsx` の Overview 判定ロジックを説明します。

## 基準ドキュメント

- デッキタイプの基準は `docs/deck_type.md` の 6分類を採用。
  - Cycle
  - Bait
  - Beatdown
  - Control
  - Siege
  - Bridge Spam

## 入力データ

- `GET /api/decks/{my_deck_key}/summary` の `deck_traits`, `deck_classes`, `cards`
- `GET /api/common/players` の `decks[].cards`（slot 0..7 を含む）
- `GET /api/common/cards` 由来の `elixirCost`（CardMaster 経由）

## カード表示とマージ

- 既存仕様どおり `card_id:slot_kind` で base(players) と summary をマージ。
- Cards は常時表示。
- 各カード行はクリックで展開し、`traits/classes` を表示。
- `classes` に `win_condition` を含むカードは強調表示（WIN CON バッジ）。

## 最小エリクサーサイクル

- 対象: slot `0..7` のカードのみ。
- その `elixirCost` を昇順に並べ、最小4枚の合計を算出。
- 表示名: `最小エリクサーサイクル`。
- 値が不足する場合（4枚未満）は `-`。

## デッキタイプ判定（近似ルール）

`docs/deck_type.md` を踏まえ、UI向けの近似として下記優先順で判定:

1. `minimumElixirCycle <= 9` -> `Cycle寄り`
2. `minimumElixirCycle >= 13` -> `Beatdown寄り`
3. `building` class が 2枚以上 -> `Siege寄り`
4. `win_condition` class が 2枚以上 かつ `building` 0枚 -> `Bridge Spam寄り`
5. `swarm` 系 trait が 2枚以上 -> `Bait寄り`
6. それ以外 -> `Control寄り`

## 耐性・速度・強み弱み

- AoE耐性: `aoe` 系 trait 数で 高め/普通/低め
- Air耐性: `anti_air` class + `air` trait 数で 高め/普通/低め
- サイクル速度:
  - `minimumElixirCycle <= 9` -> 高速
  - `<= 12` -> 中速
  - それ以上 -> 低速
- 強み/弱み:
  - trait/class/cycle の閾値判定で候補文を作成し、最大3件を表示

---

注意: これは意思決定を速くするためのフロントエンド近似ロジックであり、
厳密な勝率モデルではありません。
