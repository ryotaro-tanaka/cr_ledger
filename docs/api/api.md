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

## Traits Resolve 仕様（card_traits + card_trait_kv）

### 用語
- Base traits: `card_traits` の固定カラムで表現される traits  
  対象: `is_air`, `can_damage_air`, `primary_target_buildings`, `is_aoe`, `is_swarm_like`
- KV traits: `card_trait_kv` の `trait_key` で表現される任意 traits  
  例: `stun`, `slowdown`, `inferno`, `knockback`, ...

### データの正規化
1. Base traits は **card_traits が唯一のベースソース**（slot_kind='all'相当）。
2. `card_trait_kv` は以下の用途のみ:
   - (a) **slot_kind 固有の例外上書き**（Base traits を上書き）
   - (b) **card_traits に存在しない trait（KV traits）** を付与する
3. Base traits を `card_trait_kv(slot_kind='all')` に書かない（禁止）。
   - KV traits の `slot_kind='all'` は許可（例: `stun` は all でOK）。

### Resolve の入力と出力
- input: `(card_id, slot_kind)`
- output: `resolved_trait_keys`（trait_key の配列）
  - **true と判定された trait_key のみを返す**
  - false / 0 の trait は **出力に含めない**（存在しない扱い）

### Resolve 手順
1) Base traits を `card_traits` から評価する  
- 値が 1（true）の Base traits のみを `resolved_trait_keys` に追加する  
- 値が 0（false）の Base traits は追加しない

2) KV traits（card_traits に存在しない trait_key）を付与する  
- `card_trait_kv` から対象行を取得（優先度: slot_kind一致 > all）
  - 対象: (card_id, slot_kind) の行
  - 追加で: (card_id, 'all') の行
- 同一 trait_key が両方にある場合は slot_kind一致を優先して採用
- これらの trait_key は `resolved_trait_keys` に追加する（true 扱い）

3) Base traits の例外上書き（slot_kind 固有のみ）
- `card_trait_kv` に存在するうち、trait_key が Base traits 名のものだけを対象にする
- 対象は (card_id, slot_kind) のみ（'all' は見ない）
- 見つかった場合、その trait_key の真偽で `resolved_trait_keys` を更新する
  - true: 含める
  - false: 除外する

### 例
例1: card_id=26000024, slot_kind='normal'
- card_traits.is_aoe = 0
- card_trait_kv に (26000024,'normal','is_aoe',1) が無い
=> `is_aoe` は resolved に含まれない

例2: card_id=26000024, slot_kind='evolution'
- card_traits.is_aoe = 0
- card_trait_kv に (26000024,'evolution','is_aoe',1) がある
=> resolved に `is_aoe` を含める（slot_kind固有の例外上書き）

例3: card_id=26000084, slot_kind='normal'
- card_traits には 'stun' は存在しない
- card_trait_kv に (26000084,'all','stun',1) がある
=> resolved に `stun` を含める（KV traits の付与）


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

## GET /api/common/player

ユーザが増えてきたら`/api/common/players`が巨大になるので必要。

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

# /api/trend

## GET /api/trend/win-conditions

特定プレイヤーの対戦ログをベースに card_classes.class_key = 'win_condition' のカードのFractionalポイントを取得する。
Fractionalでカードをカウントする。1試合に1ポイントずつある。
相手のデッキのwin_conditionのカード枚数によってポイントの割り振り方が変わる。
- win_conditionカード1枚: 対象のwin_conditionカードに1ポイント。
- win_conditionカードk枚: 対象の各win_conditionカードに1/kポイント。
- win_conditionカード0枚: no_win_condition_pointsに1ポイント。
total_points は対象となった試合数に等しい。
cardsはfractional_pointsの降順（多い順）に並べる。

<!-- 
そのwin_conditionが単体で使われるか、複数win_conditionで使われるか、
また複数で使われるならどのwin_conditionとセットで使われるのかの分析が必要かもしれない 
個人バトルログをベースにしているからデータが少なく作れない？
-->

- required query parameter:
  - `player_tag`: string
- optional query parameter:
  - `last`: number - 直近バトル数のフィルタ(default 200, max 5000)
  <!-- - `seasons`: number - 直近シーズン -->
<!-- - response:
  - `200`: `{ ok, filter, no_win_condition_points, total_points, cards }` -->

Response Structure (200):
- `ok`: boolean
- `filter`: object
  - `last`: number
- `no_win_condition_points`: number
- `total_points`: number
- `cards`: array
  - `card_id`: number
  - `slot_kind`: "normal" | "evolution" | "hero" | "support"
  - `fractional_points`: number

Sample Response (shortened):
```json
{
    "ok": true,
    "filter": { "last": 200 },
    "no_win_condition_points": 0,
    "total_points": 200,
    "cards": [
        {
            "card_id": 26000000,
            "slot_kind": "normal",
            "fractional_points": 10.5
        }
    ]
}
```
## GET /api/trend/pair/win-condition

## GET /api/trend/{player_tag}/traits

対象プレイヤーが遭遇した相手デッキについて、各 trait の デッキ内枚数分布（Encounter-weighted） を返す。
1バトル=1サンプルとして扱い、相手デッキ内の「traitを持つカード枚数」を集計する。

カウントの定義:
- 1バトル（相手デッキ1つ）につき、各 trait について以下を算出する:
  trait_count = 相手デッキ内で trait=true のカード枚数
- P(trait_count = k) = そのkになったバトル数 / total_battles
- deck_size: support を含めて9枚で数える

データソース:
- seasons: 直近シーズン数を指定する。
  seasonsで対象が古すぎたら最古のシーズンを開始日にする。シーズン対象にしない
- battles: player_tag と期間で対象 battle_id を取得
- battle_opponent_cards: battle_id -> (card_id, slot_kind) の相手カード一覧
- trait 解決: [traits 解決](#traits-解決)
  - base traits: card_traits
  - kv traits: card_trait_kv

ユーザが以下の内容を分布だけで判断できる:
- is_aoe の rate_ge_2 が高い → 「swarmの重い札はリスク」
- is_swarm_like の分布が低い → 「AoEを捨ててもよい」検討

- Path parameter:
  - `player_tag`: string
- optional query parameter:
  - `seasons`: number - 直近何シーズン分を対象にする（default 2, max 6）

Response Structure (200):
- `ok`: boolean
- `filter`: object
  - `seasons`: number
- `total_battles`: number
- `traits`: array
  - `trait_key`: string
  - `distribution`: array - kごとの分布
    - `count`: number - trait_count = k
    - `battles`: number - そのkだったバトル数
    - `rate`: number - battles / total_battles
  - `summary`: object
    - `mean_count`: number - 平均枚数
    - `rate_ge_2`: number - k>=2 の割合：意思決定に効くので標準で付けるのがおすすめ

Sample Response (shortened):
```json
{
  "ok": true,
  "filter": {
    "seasons": 2,
    "include_support": 0,
    "traits": ["is_aoe", "stun"]
  },
  "total_battles": 100,
  "deck_size": 8,
  "traits": [
    {
      "trait_key": "is_aoe",
      "distribution": [
        { "count": 0, "battles": 8,  "rate": 0.08 },
        { "count": 1, "battles": 34, "rate": 0.34 },
        { "count": 2, "battles": 41, "rate": 0.41 },
        { "count": 3, "battles": 14, "rate": 0.14 },
        { "count": 4, "battles": 3,  "rate": 0.03 }
      ],
      "summary": {
        "mean_count": 1.73,
        "rate_ge_2": 0.58
      }
    },
    {
      "trait_key": "stun",
      "distribution": [
        { "count": 0, "battles": 62, "rate": 0.62 },
        { "count": 1, "battles": 31, "rate": 0.31 },
        { "count": 2, "battles": 7,  "rate": 0.07 }
      ],
      "summary": {
        "mean_count": 0.45,
        "rate_ge_2": 0.07
      }
    }
  ]
}
```

# /api/decks

## GET /api/decks/{my_deck_key}/matchups/by-traits

<!-- 未実装 -->
デッキの対traitsの勝率を出力する。

- 
- required query parameter:
- optional query parameter:
  - `last`: number - 直近バトル数のフィルタ(default 200, max 5000)
  - `seasons`: number - 対象シーズン数のフィルタ(default 2)
<!-- - response:
  - `200`: `{ ok, filter, traits }` -->

Response Structure (200):
- `ok`: boolean
- `filter`: object
  - `last`: number
- `traits`: array
  - `name`: string
  - `point`: number
  - `cards`: array
    - `cards_id`: number
    - `slot_kind`: "normal" | "evolution" | "hero" | "support"

Sample Response (shortened):

```json
```

## GET /api/decks/{my_deck_key}/matchups/by-win-condition

## GET /api/decks/{my_deck_key}/traits
## GET /api/decks/{my_deck_key}/summary

この API は デッキの構造（カード・trait・class）のみを返す。
戦績・トレンド・相性（勝率）などの 動的集計とelixir_costは含めない（別 API で取得しフロントで合成する）。
/api/common/players をクライアントで実行している前提で、decksを補足する。

- cards: my_deck_cardsテーブルからcard_idとslot_kindを取得し、card_trait_kvとcard_traitと紐づける。
- deck_traits: 上記のcards情報からこのデッキの**各trait_keyを持つカードの枚数**をカウントする。
- deck_classes: 上記のcards情報からこのデッキの**各class_keyを持つカードの枚数**をカウントする。

[traits 解決](#traits-解決)

<!-- 
min_elixir_cycle:
  - 低い: 後出しでカードが出しやすい。対応力が高い。特に序盤でディフェンスがしやすい。6以下。
  - 高い: 後出しでカードを出しにくい。対応力が低い。特に序盤でディフェンスがしにくい。 8以上。
-->

- Path parameter:
  - `my_deck_key`: string

Response Structure (200):
- `ok`: boolean
- `deck_traits`: array
  - `trait_key`: string
  - `count`: number
- `deck_classes`: array
  - `class_key`: string
  - `count`: number
<!-- - `min_elixir_cycle`: number -->
- `cards`: array
  - `card_id`: number
  - `slot_kind`: "normal" | "evolution" | "hero" | "support"
  - `card_type`: 'unit' | 'spell' | 'building' | 'support'
  - `card_traits`: array[string]
  - `classes`: array[string]

Sample Response (shortened):

```json
{
    "ok": true,
    "deck_traits": [
      {
        "trait_key": "stun",
        "count": 1
      },
      {
        "trait_key": "is_aoe",
        "count": 1
      }
    ],
    "deck_classes": [
      {
        "class_key": "tank",
        "count": 1
      }
    ],
    "cards": [
        {
          "card_id": 26000000,
          "slot_kind": "evolution",
          "card_type": "unit",
          "card_traits": ["stun", "is_aoe"],
          "classes": ["tank"],
        }
    ]
}
```
