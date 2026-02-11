# Review update: `GET /api/decks/{my_deck_key}/defense/threats`

## 結論
- **実装可能**。
- レビュー指摘に対する反映として、仕様を以下に確定する。

## 確定仕様（今回反映）
1. **ソート順は `offense/counters` と同一**
   - `threat_score DESC`
   - `delta_vs_baseline ASC`
   - `battles_with_element DESC`
   - ※ `offense/counters` の既存 `sortCounterRows` と同じ順序に合わせる。

2. **`min` パラメータは削除**
   - クエリパラメータ `min` は持たない。
   - `battles_with_element >= min` のフィルタも実施しない。

3. **`my_deck_key` decode 失敗時は 400**
   - エラー: `invalid my_deck_key`。

4. **`summary.win_condition_total_encounters` は追加しない**
   - `summary` は `total_battles`, `baseline_win_rate` のみ。

5. **`threats` 要素は `card_id` + `slot_kind` を必須化**
   - 要素識別は card 単体ではなく `(card_id, slot_kind)` をキーとする。

## 既存実装/データとの整合ポイント
- ルーティングは `worker.js` の既存パターン（`/api/decks/{...}` + suffix）に沿って追加可能。
- 集計骨格は `offense/counters` の実装資産を再利用可能。
- DBスキーマ上、対象抽出・集計に必要なテーブル（`battles`, `battle_opponent_cards`, `card_classes`）は揃っている。
- `result` は DB/既存コードともに文字列 `win/loss/draw` なので、本APIもそれに合わせる。

## 実装メモ（最小実装）
- handler: `handleDeckDefenseThreats(env, url, path)` を `handlers/decks.js` に追加。
- 対象試合: `my_deck_key` 一致 + `result IN ('win','loss')` + seasons境界。
- 要素抽出: `battle_opponent_cards` と `card_classes(class_key='win_condition')` を join。
- 集計単位: `(card_id, slot_kind)`。
- 指標: `battles_with_element`, `encounter_rate`, `win_rate_given`, `delta_vs_baseline`, `threat_score`。
- 並び順: 本文「確定仕様 1」の順序を適用。

## 補足
- 本APIは因果を保証しない。条件付き勝率ベースの統計的関連を返す。
