# DB Design Notes (CR_ledger)

## 基本思想
- このDBは「分析補助」であり正解を出さない
- 勝率・傾向は常にサンプル数とセットで扱う
- Tier / Meta を直接モデル化しない

## card_traits / card_trait_kv の分離理由
- 固定・客観・仕様由来のみを card_traits に置く。
- 例外・条件付き・意見が入りうる要素は card_trait_kv に逃がす。
- 新仕様では trait_value を 0–100 の整数値で任意に保持でき、NULL は存在のみを示す。これにより「存在のみ」か「強度付き」かを扱いやすくする。
- 主キーは (card_id, slot_kind, trait_key) として一意性を担保し、trait_key は trait_keys を参照する外部キー制約がある。
- インデックスは実用的最小限（card_id / slot_kind / (trait_key, slot_kind)）を用意して検索性能を確保する。

## class の扱い
- class は公式分類だが信頼度は高くない
- 誤字防止のため CHECK のみ
- 分析の主軸には使わない

## FK を張っていない理由
- 運用上の柔軟性を優先
- 一部は論理的参照に留めている
- 将来必要なら再作成で追加可能

## 時刻の扱い
- battle_time は TEXT
- ISO8601 前提で範囲検索・並び替えを行う

## 将来変更しそうな点
- card_trait_kv.trait_value の NULL 許容
- battles への season / patch 情報の付与
- 共起分析用の集計テーブル追加（キャッシュ用途）

## やらないこと
- 環境 Tier の直接管理
- プレイング最適化ロジック
- 全ユーザ横断の統計

## 関連ドキュメント（DB 詳細）

以下のファイル・ディレクトリに DB 設計や実データのサンプルをまとめています。実装や解析に参照してください。

- [docs/db/schema.md](docs/db/schema.md)
  テーブル定義・カラムの意味・制約・インデックスの解説（主ドキュメント）。PRAGMA 出力は末尾に追記しています。

- [docs/db/schema.er.md](docs/db/schema.er.md)
  Mermaid による ER 図（構造の見通し用）。

- [docs/db/sample.md](docs/db/sample.md)
  各テーブルの実データ例（最大5行）を CSV 形式で示したサンプル。スキーマ理解やクエリ検証に便利です。

- docs/db/seeds/
  手入力で用意した分析向けの実データ（CSV 等）を保存するディレクトリ。テスト・手動検証やシード投入用の素材が含まれます。公開前に含まれるデータの確認を推奨します。


## Traits Resolve（API参照）

`/api/trend/{player_tag}/traits` と `/api/decks/{my_deck_key}/summary` などで使う trait 解決ルール。

- Base traits: `card_traits` 固定カラム（`is_air`, `can_damage_air`, `primary_target_buildings`, `is_aoe`, `is_swarm_like`）
- KV traits: `card_trait_kv.trait_key`（例: `stun`, `slowdown`, `inferno`, `knockback`）

Resolve 手順:
1. Base traits を `card_traits` から評価し、true のみ採用。
2. KV traits を `card_trait_kv` から採用（優先度: `slot_kind` 一致 > `all`）。
3. Base traits 名と同じ `trait_key` が `slot_kind` 行にある場合は上書き（true なら追加、false なら除外）。

例:
- `card_traits.is_aoe = 0` かつ上書きなし → `is_aoe` は含まれない。
- `card_traits.is_aoe = 0` だが `('evolution','is_aoe',1)` あり → `is_aoe` を含める。
- `stun` が `all` で付与される → `stun` を含める。

## 集計系APIの定義（API参照）

`/api/decks/{my_deck_key}/offense/counters` と `/api/decks/{my_deck_key}/defense/threats` の共通定義。

- 対象バトル集合: `my_deck_key` 一致 + 必要に応じて `seasons` 期間フィルタ。`draw` は除外。
- `baseline_win_rate`: 対象集合での勝率。
- `battles_with_element`: 相手デッキに要素が含まれた試合数。
- `encounter_rate = battles_with_element / total_battles`
- `win_rate_given`: 要素を含む試合に限った勝率。
- `delta_vs_baseline = win_rate_given - baseline_win_rate`
- `threat_score = encounter_rate * max(0, baseline_win_rate - win_rate_given)`

主な参照テーブル（実装観点）:
- `battles`
- `battle_opponent_cards`
- `card_traits`
- `card_trait_kv` / `trait_keys`
- `card_classes`
