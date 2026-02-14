# API Response Examples (Current)

このファイルは `docs/api/api.md` から分離した 200系レスポンス例です。

## GET /api/common/players

Response example (200):
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

## PATCH /api/common/my-decks/name

Response example (200):
```json
{
  "ok": true,
  "my_deck_key": "GYVCJJCR0::26000010:normal|...|159000000:support",
  "deck_name": "my ladder deck"
}
```

## POST /api/common/sync

Response example (200):
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
    { "status": "skipped", "reason": "non-target gameMode: DraftMode_Princess" },
    {
      "status": "upserted",
      "battle_id": "VLLCRRLLV_QY8P9JJ_20260204T065501.000Z_pathOfLegend",
      "my_deck_key": "VLLCRRLLV::26000000:..."
    }
  ]
}
```

## GET /api/common/cards

Response example (200):
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
      "iconUrls": { "medium": "https://api-assets.clashroyale.com/...png" },
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

## GET /api/common/classes

Response example (200):
```json
{
  "ok": true,
  "classes": [
    { "class_key": "tank", "card_ids": [10000, 1000001, 122201] }
  ]
}
```

## GET /api/trend/{player_tag}/win-conditions

Response example (200):
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

## GET /api/trend/{player_tag}/traits

Response example (200):
```json
{
  "ok": true,
  "filter": { "seasons": 2 },
  "total_battles": 100,
  "deck_size": 9,
  "traits": [
    {
      "trait_key": "is_aoe",
      "distribution": [
        { "count": 0, "battles": 8, "rate": 0.08 },
        { "count": 1, "battles": 34, "rate": 0.34 }
      ],
      "summary": { "mean_count": 1.73, "rate_ge_2": 0.58 }
    }
  ]
}
```

## GET /api/decks/{my_deck_key}/summary

Response example (200):
```json
{
  "ok": true,
  "deck_traits": [
    { "trait_key": "stun", "count": 1 },
    { "trait_key": "is_aoe", "count": 1 }
  ],
  "deck_classes": [
    { "class_key": "tank", "count": 1 }
  ],
  "cards": [
    {
      "card_id": 26000000,
      "slot_kind": "evolution",
      "card_type": "unit",
      "card_traits": ["stun", "is_aoe"],
      "classes": ["tank"]
    }
  ]
}
```

## GET /api/decks/{my_deck_key}/offense/counters

Response example (200):
```json
{
  "ok": true,
  "filter": { "seasons": 2 },
  "summary": {
    "total_battles": 184,
    "baseline_win_rate": 0.538,
    "win_condition_cards": [
      { "card_id": 26000000, "slot_kind": "normal" }
    ]
  },
  "counters": {
    "cards": [
      {
        "card_id": 28000011,
        "slot_kind": "normal",
        "stats": {
          "battles_with_element": 62,
          "encounter_rate": 0.337,
          "win_rate_given": 0.403,
          "delta_vs_baseline": -0.135,
          "threat_score": 0.0455
        }
      }
    ],
    "traits": [
      {
        "trait_key": "stun",
        "description": "Zap系カードの代表的効果。対象の行動を一瞬停止させる…",
        "stats": {
          "battles_with_element": 71,
          "encounter_rate": 0.386,
          "win_rate_given": 0.451,
          "delta_vs_baseline": -0.087,
          "threat_score": 0.0336
        }
      }
    ]
  }
}
```

## GET /api/decks/{my_deck_key}/defense/threats

Response example (200):
```json
{
  "ok": true,
  "filter": { "seasons": 2 },
  "summary": {
    "total_battles": 184,
    "baseline_win_rate": 0.538
  },
  "threats": [
    {
      "card_id": 26000000,
      "slot_kind": "normal",
      "stats": {
        "battles_with_element": 62,
        "encounter_rate": 0.337,
        "win_rate_given": 0.403,
        "delta_vs_baseline": -0.135,
        "threat_score": 0.0455
      }
    }
  ]
}
```
