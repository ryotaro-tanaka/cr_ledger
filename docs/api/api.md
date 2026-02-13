# API仕様 (CR_ledger) — Current

このドキュメントは現行（Current）APIの仕様です。legacy API は `docs/api/legacy.md` を参照してください。

## 位置づけ（Current / Legacy）

- Current: 新規実装・今後のフロント移行先。
- Legacy: 現在のフロントが利用中。互換維持対象だが将来的に廃止予定。

## Base URL

`https://cr-ledger.ryotaro-tanaka.workers.dev`

## 共通仕様

- レスポンスは原則 JSON（例外: `GET /` は `text/plain`）。
- すべてのエンドポイントで CORS 有効。
- `OPTIONS` は `204` を返し CORS ヘッダを含む。

## 共通認証

- Bearer トークン必須。
- Header: `Authorization: Bearer <CR_LEDGER_AUTH>`
- 認証エラー: `401`
- サーバ設定不備（トークン未設定など）: `500`

## 共通パラメータ・型

- `player_tag`: プレイヤータグ（先頭 `#` は有無どちらでも可のAPIあり）。
- `my_deck_key`: `{player_tag}::{card_id}:{slot_kind}|{card_id}:{slot_kind}|...`
  - 例: `GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|...|159000000:support`
- `slot_kind`: `normal | evolution | hero | support`
- `last`: 直近バトル数。用途別デフォルト/上限あり（各API参照）。
- `seasons`: 直近シーズン数。用途別デフォルト/上限あり（各API参照）。

## 共通レスポンス

- 成功時は原則 `ok: true` を含む。
- 失敗時 `ok: false` の詳細構造は本書では未規定。

## GET /

利用可能なエンドポイント例を `text/plain` で返します。

Request:
- Auth: Required
- Path Params: なし
- Query Params: なし
- JSON Body: なし

Responses:
- 200: `text/plain`

Response schema (200):
- プレーンテキスト

Notes:
- このルートは legacy ではなく current の継続運用対象。

## GET /api/common/player

単一プレイヤー取得用の分割エンドポイント（将来拡張用）です。

Request:
- Auth: Required
- Path Params: なし
- Query Params: 仕様策定中
- JSON Body: なし

Responses:
- 501: 未実装（仕様策定中）

Response schema (200):
- 未実装（仕様策定中）

Notes:
- `/api/common/players` の肥大化対策として必要になる想定。

## GET /api/common/players

既知プレイヤー一覧と各プレイヤーのデッキ情報を一括取得します。

Request:
- Auth: Required
- Path Params: なし
- Query Params:
  - `last` (optional, default 200, max 5000)
- JSON Body: なし

Responses:
- 200: `{ ok, filter, players }`

Response schema (200):
- `ok`: boolean
- `filter.last`: number
- `players[]`:
  - `player_tag`: string
  - `player_name`: string
  - `total_battles`: number
  - `decks[]`:
    - `my_deck_key`: string
    - `deck_name`: string | null
    - `battles`: number
    - `cards[]`:
      - `slot`: number
      - `card_id`: number
      - `slot_kind`: `normal | evolution | hero | support`

Notes:
- legacy の `players / my-decks / my-deck-cards` 相当を統合した current API。

## PATCH /api/common/my-decks/name

デッキ名を更新またはクリアします。

Request:
- Auth: Required
- Path Params: なし
- Query Params: なし
- JSON Body:
  - `my_deck_key`: string (required)
  - `deck_name`: string（空文字でクリア）

Responses:
- 200: `{ ok, my_deck_key, deck_name }`
- 400: 入力不正
- 404: デッキ未存在

Response schema (200):
- `ok`: boolean
- `my_deck_key`: string
- `deck_name`: string

Notes:
- legacy `PATCH /api/my-decks/name` と互換。

## POST /api/common/sync

指定プレイヤーの battlelog を取得して DB に upsert します。

Request:
- Auth: Required
- Path Params: なし
- Query Params: なし
- JSON Body:
  - `player_tag`: string (optional)

Responses:
- 200: 同期サマリと明細
- 400: パラメータ不正

Response schema (200):
- `ok`: boolean
- `synced`:
  - `total_fetched`: number
  - `upserted`: number
  - `skipped`: number
  - `skipped_non_target`: number
  - `skipped_other`: number
  - `stopped_early`: number
- `results[]`:
  - `status`: `upserted | skipped`
  - `battle_id?`: string
  - `my_deck_key?`: string
  - `reason?`: string

Notes:
- current では `player_tag` を JSON Body で渡す（legacy は query）。

## GET /api/common/cards

カードマスタ情報を返します。

Request:
- Auth: Required
- Path Params: なし
- Query Params:
  - `nocache` (optional): `1` でキャッシュバイパス
- JSON Body: なし

Responses:
- 200: `{ ok, source, items, supportItems }`

Response schema (200):
- `ok`: boolean
- `source`: string
- `items[]`: 通常カード
  - `name`: string
  - `id`: number
  - `maxLevel`: number
  - `maxEvolutionLevel?`: number
  - `elixirCost?`: number
  - `iconUrls`: object
  - `rarity`: string
- `supportItems[]`: サポートカード

Notes:
- legacy `GET /api/cards` の current 版。

## GET /api/trend/win-conditions

相手デッキの win_condition 分布を fractional ポイントで集計します。

Request:
- Auth: Required
- Path Params: なし
- Query Params:
  - `player_tag`: string (required)
  - `last`: number (optional, default 200, max 5000)
- JSON Body: なし

Responses:
- 200: `{ ok, filter, no_win_condition_points, total_points, cards }`

Response schema (200):
- `ok`: boolean
- `filter.last`: number
- `no_win_condition_points`: number
- `total_points`: number
- `cards[]`:
  - `card_id`: number
  - `slot_kind`: `normal | evolution | hero | support`
  - `fractional_points`: number

Notes:
- 1試合あたり総ポイントは 1。
- 相手側 win_condition が `k` 枚なら各カードに `1/k` を配分。
- 0枚なら `no_win_condition_points` に 1 を加算。

## GET /api/trend/pair/win-condition

win_condition の組み合わせ傾向を返す予定のエンドポイントです。

Request:
- Auth: Required
- Path Params: なし
- Query Params: 未定
- JSON Body: なし

Responses:
- 501: 未実装（仕様策定中）

Response schema (200):
- 未実装（仕様策定中）

Notes:
- 実装・スキーマともに未確定。

## GET /api/trend/{player_tag}/traits

相手デッキにおける trait 枚数分布（Encounter-weighted）を返します。

Request:
- Auth: Required
- Path Params:
  - `player_tag`: string
- Query Params:
  - `seasons`: number (optional, default 2, max 6)
- JSON Body: なし

Responses:
- 200: `{ ok, filter, total_battles, traits }`

Response schema (200):
- `ok`: boolean
- `filter.seasons`: number
- `total_battles`: number
- `traits[]`:
  - `trait_key`: string
  - `distribution[]`:
    - `count`: number
    - `battles`: number
    - `rate`: number
  - `summary`:
    - `mean_count`: number
    - `rate_ge_2`: number

Notes:
- 1バトル=1サンプル。
- `trait_count` は相手デッキ内で当該traitが true のカード枚数。
- trait 判定ルールは Appendix A を参照。

## GET /api/decks/{my_deck_key}/matchups/by-traits

デッキの対 trait 勝率を返す予定のエンドポイントです。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params:
  - `last`: number (optional, default 200, max 5000)
  - `seasons`: number (optional, default 2)
- JSON Body: なし

Responses:
- 501: 未実装（仕様策定中）

Response schema (200):
- 草案:
  - `ok`: boolean
  - `filter.last`: number
  - `traits[]`:
    - `name`: string
    - `point`: number
    - `cards[]`:
      - `card_id`: number
      - `slot_kind`: `normal | evolution | hero | support`

Notes:
- 仕様策定中のため、レスポンス草案は変更可能性あり。

## GET /api/decks/{my_deck_key}/matchups/by-win-condition

デッキの対 win_condition 勝率を返す予定のエンドポイントです。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params: 未定
- JSON Body: なし

Responses:
- 501: 未実装（仕様策定中）

Response schema (200):
- 未実装（仕様策定中）

Notes:
- 実装・スキーマともに未確定。

## GET /api/decks/{my_deck_key}/traits

デッキの trait 集計を返す予定のエンドポイントです。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params: 未定
- JSON Body: なし

Responses:
- 501: 未実装（仕様策定中）

Response schema (200):
- 未実装（仕様策定中）

Notes:
- 同等情報は現時点では `/api/decks/{my_deck_key}/summary` に含まれる。

## GET /api/decks/{my_deck_key}/summary

デッキの構造情報（cards / traits / classes）のみを返します。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params: なし
- JSON Body: なし

Responses:
- 200: `{ ok, deck_traits, deck_classes, cards }`

Response schema (200):
- `ok`: boolean
- `deck_traits[]`:
  - `trait_key`: string
  - `count`: number
- `deck_classes[]`:
  - `class_key`: string
  - `count`: number
- `cards[]`:
  - `card_id`: number
  - `slot_kind`: `normal | evolution | hero | support`
  - `card_type`: `unit | spell | building | support`
  - `card_traits`: string[]
  - `classes`: string[]

Notes:
- 戦績・トレンド・勝率などの動的集計は含まない。
- trait 判定ルールは Appendix A を参照。

## GET /api/decks/{my_deck_key}/offense/counters

相手要素（card / trait）と勝率悪化の関連から「止め手」をランキング化します。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params:
  - `seasons`: number (optional, default 2, max 6)
- JSON Body: なし

Responses:
- 200: `{ ok, filter, summary, counters }`

Response schema (200):
- `ok`: boolean
- `filter.seasons`: number
- `summary`:
  - `total_battles`: number
  - `baseline_win_rate`: number (0..1)
  - `win_condition_cards[]`:
    - `card_id`: number
    - `slot_kind`: `normal | evolution | hero | support`
- `counters.cards[]`:
  - `card_id`: number
  - `slot_kind`: string
  - `stats`:
    - `battles_with_element`: number
    - `encounter_rate`: number
    - `win_rate_given`: number
    - `delta_vs_baseline`: number
    - `threat_score`: number
- `counters.traits[]`:
  - `trait_key`: string
  - `description`: string | null
  - `stats`: 上記 card と同じ

Notes:
- 因果を保証しない統計的関連。
- `encounter_rate` と `delta_vs_baseline` の併記で解釈する。
- 集計定義の詳細は Appendix B を参照。

## GET /api/decks/{my_deck_key}/defense/threats

相手 win_condition と勝率悪化の関連から「攻め手」をランキング化します。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params:
  - `seasons`: number (optional, default 2, max 6)
- JSON Body: なし

Responses:
- 200: `{ ok, filter, summary, threats }`

Response schema (200):
- `ok`: boolean
- `filter.seasons`: number
- `summary`:
  - `total_battles`: number
  - `baseline_win_rate`: number (0..1)
- `threats[]`:
  - `card_id`: number
  - `slot_kind`: `normal | evolution | hero | support`
  - `stats`:
    - `battles_with_element`: number
    - `encounter_rate`: number
    - `win_rate_given`: number
    - `delta_vs_baseline`: number
    - `threat_score`: number

Notes:
- 因果を保証しない統計的関連。
- 主対象は相手の win_condition（最小実装）。
- 並び順は `threat_score DESC` → `delta_vs_baseline ASC` → `battles_with_element DESC`。

## Appendix A: Traits Resolve（実装詳細）

運用向け本文から分離した、trait 解決ロジックの実装寄り詳細です。

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

## Appendix B: 集計系APIの定義（実装詳細）

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
