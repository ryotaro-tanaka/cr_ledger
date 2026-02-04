# API Specification (CR_ledger)

This document describes the current HTTP API exposed by the Cloudflare Worker.
All endpoints listed here are **legacy endpoints** that remain for compatibility
with the existing client, and will be replaced by a new API in the future.

## Base URL

Set by your Cloudflare Workers deployment.

## Auth

All requests (except CORS preflight) require a bearer token.

```
Authorization: Bearer <CR_LEDGER_AUTH>
```

If the token is missing or invalid, the API returns `401`.
If the server is misconfigured (missing token), it returns `500`.

## Common behavior

- Responses are JSON unless otherwise noted.
- CORS is enabled for all endpoints.
- `OPTIONS` requests return `204` with CORS headers.

## Legacy endpoints

### GET /

Returns a plain-text list of example endpoints.

**Response**
- `200 text/plain`

---

### POST /api/sync

Fetches battlelog data for the specified player and upserts it into the DB.

**Query parameters**
- `player_tag` (required): player tag (with or without leading `#`).

**Response**
- `200` on success with summary and per-entry results.
- `400` if the battlelog is empty or the parameter is invalid.

---

### GET /api/players

Lists known players.

**Response**
- `200` with `{ ok, players }`.

---

### GET /api/my-deck-cards

Returns cards for a specific deck.

**Query parameters**
- `my_deck_key` (required)

**Response**
- `200` with `{ ok, my_deck_key, cards }`
- `400` if `my_deck_key` is missing

---

### GET /api/stats/my-decks

Returns recent deck usage for a player.

**Query parameters**
- `player_tag` (required): player tag (with or without leading `#`)
- `last` (optional): number of recent battles to consider (default 200, max 5000)

**Response**
- `200` with `{ ok, player_tag, filter, total_battles, decks }`

---

### GET /api/cards

Returns card master data proxied from RoyaleAPI.

**Query parameters**
- `nocache` (optional): set to `1` to bypass edge cache

**Response**
- `200` with `{ ok, source, items, supportItems }`

---

### GET /api/stats/opponent-trend

Aggregates opponent card usage for a player.

**Query parameters**
- `player_tag` (required)
- `last` (optional): number of recent battles to consider (default 200, max 5000)
- `since` (optional): ISO8601 timestamp; if present, takes precedence over `last`

**Response**
- `200` with `{ ok, player_tag, filter, total_battles, cards }`

---

### GET /api/stats/matchup-by-card

Shows win rates against opponent cards for a specific deck.

**Query parameters**
- `my_deck_key` (required)
- `last` (optional): number of recent battles to consider (default 500, max 5000)

**Response**
- `200` with `{ ok, my_deck_key, filter, total_battles, cards }`
- `400` if `my_deck_key` is missing

---

### GET /api/stats/priority

Combines opponent trend and deck weakness into a priority score.

**Query parameters**
- `player_tag` (required)
- `my_deck_key` (required)
- `last` (optional): number of recent battles to consider (default 500, max 5000)

**Response**
- `200` with `{ ok, player_tag, my_deck_key, filter, total_battles, cards }`
- `400` if `my_deck_key` is missing

---

### PATCH /api/my-decks/name

Updates a deck name or clears it.

**JSON body**
```
{
  "my_deck_key": "...",
  "deck_name": "optional name (empty string clears)"
}
```

**Response**
- `200` with `{ ok, my_deck_key, deck_name }`
- `400` if inputs are invalid
- `404` if the deck does not exist
