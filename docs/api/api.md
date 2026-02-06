# API仕様 (CR_ledger) — Legacy

このドキュメントは Cloudflare Worker が公開する現在の HTTP API を説明します。

## Base URL

`https://cr-ledger.ryotaro-tanaka.workers.dev`

## 認証

すべてのリクエストで Bearer トークンが必要です。

`Authorization: Bearer <CR_LEDGER_AUTH>`

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

レガシー扱いの API 仕様は別ファイルに分割しました。詳細は以下を参照してください。

- [docs/api/legacy.md](docs/api/legacy.md)

---

# GET /

- 説明: 利用可能なエンドポイント例を text/plain で返します。
- 備考: このルート（GET /）はレガシーではなく現行エンドポイントとして継続運用されます。
- レスポンス: `200 text/plain`

---

# 共通ユーティリティ API (/api/common)

## A. GET /api/common/players

- 説明: 既知のプレイヤー一覧と各プレイヤーのデッキ情報（my-decks / my-deck-cards 相当）を一括で返します。フロントの導線を簡潔にするため players / my-decks / my-deck-cards を統合したエンドポイントです。
- クエリパラメータ:
  - `last`（任意）: 直近バトル数のフィルタ（デフォルト 200 / 最大 5000）
- レスポンス: `200` `{ ok, players }`

レスポンス構造（200）:

- `ok`: boolean
- `filter`: object - このレスポンス全体に適用された集計条件
  - `last`: number
- `players`: array
  - `player_tag`: string
  - `player_name`: string
  - `total_battles`: number
  - `decks`: array
    - `my_deck_key`: string
    - `deck_name`: string | null
    - `battles`: number
    - `cards`: array
      - `slot`: number
      - `card_id`: number
      - `slot_kind`: "normal" | "evolution" | "hero" | "support"

簡易レスポンス例（短縮）:

```json
{
  "ok": true,
  "filter": { "last": 200 },
  "players": [
    {
      "player_tag": "GYVCJJCR0",
      "player_name": "tanakar",
      "total_battles": 200,
      "decks": [
        {
          "my_deck_key": "GYVCJJCR0::27000010:evolution|...|159000000:support",
          "deck_name": "name",
          "battles": 200,
          "cards": [
            { "slot": 0, "card_id": 27000010, "slot_kind": "evolution" }
          ]
        }
      ]
    }
  ]
}
```

---

## B. PATCH /api/common/my-decks/name

- 説明: デッキ名を更新またはクリアします（レガシーの `/api/my-decks/name` と互換）。空文字ならクリアする（null）。
- JSON body:
  - `my_deck_key`: string（必須）
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

## C. POST /api/common/sync

- 説明: 指定プレイヤーの battlelog を取得して DB に upsert します。JSON body で `player_tag` を受け取ります。
- JSON body:
  - `player_tag`: string（任意）
- レスポンス:
  - `200` 正常時（サマリ + 明細）
  - `400` パラメータ不正

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
  - `status`: "upserted" | "skipped"
  - `battle_id`: string — status="upserted" の場合に含まれる
  - `my_deck_key`: string — 同上
  - `reason`: string — status="skipped" の場合に含まれる

注記: body に `player_tag` を渡す方法に切り替わった点に注意してください。

簡易レスポンス例（短縮）:

```json
{
    "ok": true,
    "synced": {
        "total_fetched": 40,
        "upserted": 11,
        "skipped": 3,
        "skipped_non_target": 3,
        "skipped_other": 0,
        "stopped_early": 1
    },
    "results": [
        {
            "status": "skipped",
            "reason": "non-target gameMode: DraftMode_Princess"
        },
        {
            "status": "upserted",
            "battle_id": "VLLCRRLLV_QY8P9JJ_20260204T065501.000Z_pathOfLegend",
            "my_deck_key": "VLLCRRLLV::26000000:..."
        }
    ]
}
```

---

## D. GET /api/common/cards

- 説明: カードマスタ情報を返します。旧 `/api/cards` と同等のレスポンスを返します（エンドポイント名のみ変更）。
- クエリパラメータ:
  - `nocache`（任意）: `1` の場合はキャッシュをバイパス
- レスポンス:
  - `200`: `{ ok, source, items, supportItems }`

レスポンス構造（200）:

- `ok`: boolean
- `source`: string
- `items`: array（通常カード）
  - `name`, `id`, `maxLevel`, `maxEvolutionLevel?`, `elixirCost?`, `iconUrls`, `rarity`
- `supportItems`: array（サポートカード）

簡易レスポンス例（短縮）:

```json
{
  "ok": true,
  "source": "proxy.royaleapi.dev",
  "items": [
    {
      "name": "Knight",
      "id": 26000000,
      "maxLevel": 16,
      "maxEvolutionLevel": 3,
      "elixirCost": 3,
      "iconUrls": {
        "medium": "https://api-assets.clashroyale.com/...png",
        "heroMedium": "https://api-assets.clashroyale.com/cardheroes/300/...png",
        "evolutionMedium": "https://api-assets.clashroyale.com/cardevolutions/300/...png"
      },
      "rarity": "common"
    }
  ],
  "supportItems": [
    {
      "name": "Tower Princess",
      "id": 159000000,
      "maxLevel": 16,
      "iconUrls": { "medium": "https://api-assets.clashroyale.com/cards/300/...png" },
      "rarity": "common"
    }
  ]
}
```
