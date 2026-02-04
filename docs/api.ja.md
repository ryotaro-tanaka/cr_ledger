# API仕様 (CR_ledger)

このドキュメントは Cloudflare Worker が公開する現在の HTTP API を説明します。
ここに記載されるエンドポイントは **すべてレガシー** であり、現行クライアント互換のために残しているものです。
将来的に新しい API に置き換える予定です。

## Base URL

Cloudflare Workers のデプロイ先 URL。

## 認証

（CORS の preflight を除き）すべてのリクエストで Bearer トークンが必要です。

```
Authorization: Bearer <CR_LEDGER_AUTH>
```

トークンが無い/不正な場合は `401` を返します。  
サーバ設定不備（トークン未設定）の場合は `500` を返します。

## 共通仕様

- レスポンスは原則 JSON（`GET /` のみ text/plain）。
- すべてのエンドポイントで CORS 有効。
- `OPTIONS` は `204` と CORS ヘッダを返します。

## レガシーエンドポイント

### GET /

利用可能なエンドポイント例を text/plain で返します。

**レスポンス**
- `200 text/plain`

---

### POST /api/sync

指定プレイヤーの battlelog を取得して DB に upsert します。

**クエリパラメータ**
- `player_tag`（必須）: プレイヤータグ（先頭 `#` は有無どちらでも可）

**レスポンス**
- `200` 正常時（サマリ + 明細）
- `400` battlelog が空、またはパラメータ不正

---

### GET /api/players

既知のプレイヤー一覧を返します。

**レスポンス**
- `200` `{ ok, players }`

---

### GET /api/my-deck-cards

指定デッキのカード一覧を返します。

**クエリパラメータ**
- `my_deck_key`（必須）

**レスポンス**
- `200` `{ ok, my_deck_key, cards }`
- `400` `my_deck_key` が未指定

---

### GET /api/stats/my-decks

プレイヤーの最近使用デッキ一覧を返します。

**クエリパラメータ**
- `player_tag`（必須）: プレイヤータグ（先頭 `#` は有無どちらでも可）
- `last`（任意）: 直近バトル数（デフォルト 200 / 最大 5000）

**レスポンス**
- `200` `{ ok, player_tag, filter, total_battles, decks }`

---

### GET /api/cards

RoyaleAPI 経由のカードマスタ情報を返します。

**クエリパラメータ**
- `nocache`（任意）: `1` の場合はキャッシュをバイパス

**レスポンス**
- `200` `{ ok, source, items, supportItems }`

---

### GET /api/stats/opponent-trend

プレイヤーが最近当たった相手カードの使用率を集計します。

**クエリパラメータ**
- `player_tag`（必須）
- `last`（任意）: 直近バトル数（デフォルト 200 / 最大 5000）
- `since`（任意）: ISO8601。指定時は `last` より優先

**レスポンス**
- `200` `{ ok, player_tag, filter, total_battles, cards }`

---

### GET /api/stats/matchup-by-card

指定デッキの対戦カード別勝率を返します。

**クエリパラメータ**
- `my_deck_key`（必須）
- `last`（任意）: 直近バトル数（デフォルト 500 / 最大 5000）

**レスポンス**
- `200` `{ ok, my_deck_key, filter, total_battles, cards }`
- `400` `my_deck_key` が未指定

---

### GET /api/stats/priority

トレンド（使用率）とデッキの弱点（勝率）から優先度を算出します。

**クエリパラメータ**
- `player_tag`（必須）
- `my_deck_key`（必須）
- `last`（任意）: 直近バトル数（デフォルト 500 / 最大 5000）

**レスポンス**
- `200` `{ ok, player_tag, my_deck_key, filter, total_battles, cards }`
- `400` `my_deck_key` が未指定

---

### PATCH /api/my-decks/name

デッキ名を更新またはクリアします。

**JSON body**
```
{
  "my_deck_key": "...",
  "deck_name": "任意の名前（空文字でクリア）"
}
```

**レスポンス**
- `200` `{ ok, my_deck_key, deck_name }`
- `400` 入力が不正
- `404` デッキが存在しない
