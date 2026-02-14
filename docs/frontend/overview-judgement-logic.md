# Overview 判定ロジック（frontend）

本ドキュメントは `frontend/src/pages/Overview.tsx` の Overview 判定ロジックを説明します。

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

## デッキタイプ判定（スコア方式）

`docs/deck_type.md` を踏まえ、固定の優先順ではなく各タイプに点数を付けて判定:

- Cycle
  - 平均エリクサーが **3未満** を強く加点
  - 最小エリクサーサイクルが速い場合に補助加点
  - WIN条件のエリクサーが軽い場合に加点
- Bait
  - `swarm` 系 trait を主軸に加点
  - `deploy_anywhere` / `outrange_tower` / `spawns_units` を補助加点
- Beatdown
  - 平均エリクサーが重い場合に加点
  - WIN条件のエリクサーが **5以上** なら強く加点
- Siege
  - 建物WIN条件と `outrange_tower` trait を強く加点
- Bridge Spam
  - `card_type=building` が無い場合に加点
  - `is_air` / `can_damage_air` / `anti_air` が少ない場合に加点
- Control
  - 上記に強く寄らない場合の受け反撃型として中庸指標で加点

補足:
- top1 と top2 の差が小さい場合やトップスコアが低い場合は `Mixed` 表示。
- UI にはタイプ判定のスコア要約（0.00-1.00）を表示。

## 耐性・速度・強み弱み

- Air耐性: `can_damage_air` trait 数をベースに判定し、`anti_air` class がある場合は少し加点
- Swarm耐性: `aoe` trait 数で 高め/普通/低め
- Giant耐性: `card_type=building` の枚数をベースに、`inferno` trait と `anti_tank` class で加点
- Building耐性: `deploy_anywhere` と `outrange_tower` trait で加点し、`primary_target_buildings` が2つ以上ならさらに加点
- サイクル速度:
  - `minimumElixirCycle <= 9` -> 高速
  - `<= 12` -> 中速
  - それ以上 -> 低速
- タイプ別ガイド: 判定結果（またはMixed上位2候補）に応じて、基本戦術・注意点・戦術ポイントを簡潔に表示
- 強み/弱み:
  - trait/class/cycle の閾値判定で候補文を作成し、最大3件を表示

---

注意: これは意思決定を速くするためのフロントエンド近似ロジックであり、
厳密な勝率モデルではありません。
