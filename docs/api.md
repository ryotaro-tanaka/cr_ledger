# API仕様 (CR_ledger) — Legacy

このドキュメントは Cloudflare Worker が公開する現在の HTTP API を説明します。
ここに記載されるエンドポイントはすべて「レガシー」であり、現行クライアント互換のために残しているものです。将来的に新しい API に置き換える予定です。

本書は、(1) 提供された現行レスポンス例、(2) 旧 api.md の説明、の両方から確認できた内容のみをまとめています。サンプルが無い項目や挙動は本書では記載していません。

## Base URL

https://cr-ledger.ryotaro-tanaka.workers.dev

## 認証

（CORS の preflight を除き）すべてのリクエストで Bearer トークンが必要です。

例:

Authorization: Bearer <CR_LEDGER_AUTH>

- トークンがない / 不正な場合: 401
- サーバ設定不備（トークン未設定など）: 500

## 共通仕様

- レスポンスは原則 JSON（例外: GET / は text/plain）。
- すべてのエンドポイントで CORS が有効。
- OPTIONS は 204 を返し、CORS ヘッダを含む。
- 成功時レスポンスには原則 `ok: true` を含む。
  - `ok: false` の構造はサンプル未提示のため本書では規定していません。

## データ型（参照）

- player_tag
  - プレイヤータグ（先頭 `#` はあってもなくても可とされるエンドポイントがあります）

- my_deck_key
  - 形式: `{player_tag}::{card_id}:{slot_kind}|{card_id}:{slot_kind}|...`
  - 例:

    GYVCJJCR0::26000010:normal|26000014:hero|26000058:evolution|...|159000000:support

- slot_kind
  - 値: `normal` / `evolution` / `hero` / `support`

---

# レガシーエンドポイント

### GET /

- 説明: 利用可能なエンドポイント例を text/plain で返します。
- 認証: Required（preflight を除く）
- レスポンス: `200 text/plain`

---

### POST /api/sync

- 説明: 指定プレイヤーの battlelog を取得して DB に upsert します。
- 認証: Required
- クエリパラメータ:
  - `player_tag`（必須）: プレイヤータグ（先頭 `#` は有無どちらでも可）
- レスポンス:
  - `200` 正常時（サマリ + 明細）
  - `400` battlelog が空、またはパラメータ不正

レスポンス構造（200 の例）:

- `ok`: boolean
- `synced`: object
- `total_fetched`: number
- `upserted`: number
- `skipped`: number
- `skipped_non_target`: number
- `skipped_other`: number
- `stopped_early`: number
- `results`: array
  - 各要素:
    - `status`: string（例: `upserted`, `skipped`）
    - `battle_id`: string
    - `my_deck_key?`: string（`status=upserted` の場合に出現する例あり）
    - `reason?`: string（`status=skipped` の場合に出現する例あり）

注記: 提供サンプルでは `GET /api/sync?player_tag=...` の形も存在していましたが、旧 api.md では `POST` と明記されているため本書では `POST /api/sync` を正として記載しています。GET が残っているかは確定できていません。

---

### GET /api/players

- 説明: 既知のプレイヤー一覧を返します。
- 認証: Required
- レスポンス: `200` で `{ ok, players }`

レスポンス構造（200）:

- `ok`: boolean
- `players`: array
  - 各要素:
    - `player_tag`: string
    - `player_name`: string

最小レスポンス例（概形）:

{ "ok": true, "players": [ { "player_tag": "...", "player_name": "..." } ] }

---

### GET /api/my-deck-cards

- 説明: 指定デッキのカード一覧を返します。
- 認証: Required
- クエリパラメータ:
  - `my_deck_key`（必須）
- レスポンス:
  - `200`: `{ ok, my_deck_key, cards }`
  - `400`: `my_deck_key` が未指定

レスポンス構造（200）:

- `ok`: boolean
- `my_deck_key`: string
- `cards`: array
  - 各要素:
    - `slot`: number（0-based）
    - `card_id`: number
    - `slot_kind`: `"normal" | "evolution" | "hero" | "support"`

---

### GET /api/stats/my-decks

- 説明: プレイヤーの最近使用デッキ一覧を返します。
- 認証: Required
- クエリパラメータ:
  - `player_tag`（必須）: プレイヤータグ（先頭 `#` は有無どちらでも可）
  - `last`（任意）: 直近バトル数（デフォルト 200 / 最大 5000）
- レスポンス:
  - `200`: `{ ok, player_tag, filter, total_battles, decks }`

レスポンス構造（200）:

- `ok`: boolean
- `player_tag`: string
- `filter`: object
  - `last`: number
- `total_battles`: number
- `decks`: array
  - `my_deck_key`: string
  - `deck_name`: string | null
  - `battles`: number

---

### GET /api/cards

- 説明: RoyaleAPI 経由のカードマスタ情報を返します。
- 認証: Required
- クエリパラメータ:
  - `nocache`（任意）: `1` の場合はキャッシュをバイパス
- レスポンス:
  - `200`: `{ ok, source, items, supportItems }`

レスポンス構造（200）:

- `ok`: boolean
- `source`: string（例: `proxy.royaleapi.dev`）
- `items`: array（通常カード）
  - `name`: string
  - `id`: number
  - `maxLevel`: number
  - `maxEvolutionLevel?`: number
  - `elixirCost?`: number
  - `iconUrls`: object
    - `medium`: string
    - `heroMedium?`: string
    - `evolutionMedium?`: string
  - `rarity`: string
- `supportItems`: array（サポートカード）
  - `name`: string
  - `id`: number
  - `maxLevel`: number
  - `iconUrls`: object
    - `medium`: string
  - `rarity`: string

---

### GET /api/stats/opponent-trend

- 説明: プレイヤーが最近当たった相手カードの使用率を集計します。
- 認証: Required
- クエリパラメータ:
  - `player_tag`（必須）
  - `last`（任意）: 直近バトル数（デフォルト 200 / 最大 5000）
  - `since`（任意）: ISO8601。指定時は `last` より優先
- レスポンス:
  - `200`: `{ ok, player_tag, filter, total_battles, cards }`

レスポンス構造（200）:

- `ok`: boolean
- `player_tag`: string
- `filter`: object
  - `last?`: number
  - `since?`: string
- `total_battles`: number
- `cards`: array
  - `card_id`: number
  - `slot_kind`: `"normal" | "evolution" | "hero" | "support"`
  - `battles`: number
  - `usage_rate`: number（0.0 - 1.0）

---

### GET /api/stats/matchup-by-card

- 説明: 指定デッキの対戦カード別勝率を返します。
- 認証: Required
- クエリパラメータ:
  - `my_deck_key`（必須）
  - `last`（任意）: 直近バトル数（デフォルト 500 / 最大 5000）
- レスポンス:
  - `200`: `{ ok, my_deck_key, filter, total_battles, cards }`
  - `400`: `my_deck_key` が未指定

レスポンス構造（200）:

- `ok`: boolean
- `my_deck_key`: string
- `filter`: object
  - `last`: number
- `total_battles`: number
- `cards`: array
  - `card_id`: number
  - `slot_kind`: `"normal" | "evolution" | "hero" | "support"`
  - `battles`: number
  - `wins`: number
  - `losses`: number
  - `win_rate`: number（0.0 - 1.0）

補足: 同一 `card_id` が `slot_kind` 違いで重複する場合があります（例: `evolution` と `normal`）。

---

### GET /api/stats/priority

- 説明: トレンド（使用率）とデッキの弱点（勝率）から優先度を算出します。
- 認証: Required
- クエリパラメータ:
  - `player_tag`（必須）
  - `my_deck_key`（必須）
  - `last`（任意）: 直近バトル数（デフォルト 500 / 最大 5000）
- レスポンス:
  - `200`: `{ ok, player_tag, my_deck_key, filter, total_battles, cards }`
  - `400`: `my_deck_key` が未指定

レスポンス構造（200）:

- `ok`: boolean
- `player_tag`: string
- `my_deck_key`: string
- `filter`: object
  - `last`: number
- `total_battles`: number
- `cards`: array
  - `card_id`: number
  - `slot_kind`: `"normal" | "evolution" | "hero" | "support"`
  - `battles_with_card`: number
  - `usage_rate`: number
  - `deck_battles_with_card`: number
  - `win_rate`: number
  - `priority_score`: number

---

### PATCH /api/my-decks/name

- 説明: デッキ名を更新またはクリアします。
- 認証: Required
- JSON body:
  - `my_deck_key`: string
  - `deck_name`: string（空文字でクリア）
- レスポンス:
  - `200`: `{ ok, my_deck_key, deck_name }`
  - `400`: 入力が不正
  - `404`: デッキが存在しない

レスポンス構造（200）:

- `ok`: boolean
- `my_deck_key`: string
- `deck_name`: string

注記: 提供サンプルでは `POST /api/my-decks/name` の形が存在していましたが、旧 api.md では `PATCH` と明記されているため本書では `PATCH /api/my-decks/name` を正として記載しています。POST が残っているかは確定できていません。

---

## TODO（未確認）

以下はこのチャット内の情報だけでは確定できないため追記保留です。

- `ok: false` のレスポンス形式（エラーコード・メッセージ構造）
- `401` / `500` のレスポンス本文の具体例
- `400` のレスポンス本文の具体例
- `/api/sync` と `/api/my-decks/name` の「互換メソッド（GET/POST）」が現状も有効かどうか
- `GET /` が返す text/plain の具体的な内容

---

(End of document)