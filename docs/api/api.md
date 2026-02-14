# API仕様 (CR_ledger) — Current

このドキュメントは現行APIの仕様です。

## 位置づけ

- Current: 本番利用中かつ継続運用対象。

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

## 共通エラーレスポンス

- エラー時の基本形は `ok: false` と `error`（string）。
- ただし「ルート未提供」の `404` は `Not Found: <path>` の `text/plain` を返す。
- 一部 API はエラー時にも追加フィールドを含む場合がある（例: sync 系）。
- 共通的なステータス:
  - `400`: 入力不正
  - `401`: 認証エラー
  - `404`: リソース未存在（該当APIのみ）
  - `500`: サーバ内部エラー（設定不備 / 予期しない例外）

## GET /

利用可能なエンドポイント例を `text/plain` で返します。

Request:
- Auth: Required
- Path Params: なし
- Query Params: なし
- JSON Body: なし

Responses:
- 401: 認証エラー
- 500: サーバ内部エラー

Response schema (200):
- プレーンテキスト

Notes:
- 現行 API の継続運用対象。

## GET /api/common/players

既知プレイヤー一覧と各プレイヤーのデッキ情報を一括取得します。

Request:
- Auth: Required
- Path Params: なし
- Query Params:
  - `last` (optional, default 200, max 5000)
- JSON Body: なし

Responses:
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/common/players」を参照。

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
- 旧来の複数 API (`players / my-decks / my-deck-cards`) を統合した API。

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
- 400: 入力不正
- 401: 認証エラー
- 404: デッキ未存在
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「PATCH /api/common/my-decks/name」を参照。

Response schema (200):
- `ok`: boolean
- `my_deck_key`: string
- `deck_name`: string

Notes:
- 旧来のデッキ名更新 API と同等の挙動。

## POST /api/common/sync

指定プレイヤーの battlelog を取得して DB に upsert します。

Request:
- Auth: Required
- Path Params: なし
- Query Params: なし
- JSON Body:
  - `player_tag`: string (required)

Responses:
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「POST /api/common/sync」を参照。

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
- `player_tag` は JSON Body で渡す。

## GET /api/common/cards

カードマスタ情報を返します。

Request:
- Auth: Required
- Path Params: なし
- Query Params:
  - `nocache` (optional): `1` でキャッシュバイパス
- JSON Body: なし

Responses:
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/common/cards」を参照。

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
- 現行のカードマスタ取得エンドポイント。

## GET /api/trend/{player_tag}/win-conditions

相手デッキの win_condition 分布を fractional ポイントで集計します。

Request:
- Auth: Required
- Path Params:
  - `player_tag`: string
- Query Params:
  - `last`: number (optional, default 200, max 5000)
- JSON Body: なし

Responses:
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/trend/{player_tag}/win-conditions」を参照。

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
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/trend/{player_tag}/traits」を参照。

Response schema (200):
- `ok`: boolean
- `filter.seasons`: number
- `total_battles`: number
- `deck_size`: number
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
- trait 判定ルールは `docs/db/notes.md` の「Traits Resolve（API参照）」を参照。

## GET /api/decks/{my_deck_key}/summary

デッキの構造情報（cards / traits / classes）のみを返します。

Request:
- Auth: Required
- Path Params:
  - `my_deck_key`: string
- Query Params: なし
- JSON Body: なし

Responses:
- 400: パラメータ不正
- 401: 認証エラー
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/decks/{my_deck_key}/summary」を参照。

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
- trait 判定ルールは `docs/db/notes.md` の「Traits Resolve（API参照）」を参照。

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
- 400: パラメータ不正
- 401: 認証エラー
- 404: デッキ未存在
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/decks/{my_deck_key}/offense/counters」を参照。

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
- 集計定義の詳細は `docs/db/notes.md` の「集計系APIの定義（API参照）」を参照。

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
- 400: パラメータ不正
- 401: 認証エラー
- 404: デッキ未存在
- 500: サーバ内部エラー

Response example (200):
- `docs/api/examples.md` の「GET /api/decks/{my_deck_key}/defense/threats」を参照。

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

## 関連ドキュメント

- Traits Resolve / 集計系APIの実装詳細は `docs/db/notes.md` を参照。
