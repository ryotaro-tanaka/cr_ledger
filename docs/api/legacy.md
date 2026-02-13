# API仕様 (CR_ledger) — Legacy

このファイルには legacy API の仕様をまとめています。

## Legacy APIの廃止方針

- 現在の利用状況:
  - フロントエンドは現時点で legacy API を利用中。
  - そのため legacy API は当面維持し、破壊的変更は行わない。
- 削除条件:
  - フロントエンドの API 呼び出しが current API（`docs/api/api.md`）へ移行完了していること。
  - 運用確認期間で重大なリグレッションがないこと。
- 削除タイミング目安:
  - 「フロント移行完了 + 安定運用確認（最低1リリースサイクル）」の後に段階的削除。
  - まずドキュメントで廃止告知し、その後実装を削除する。

## 前提（共通）

- レスポンスは原則 JSON。
- OPTIONS は 204 を返し、CORS ヘッダを含む。
- 成功時レスポンスには原則 `ok: true` を含む。

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

---
