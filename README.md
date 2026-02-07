# CR_ledger

CR_ledger is an analysis tool focused on
continuously collecting a single player's battlelog in Clash Royale
and helping that player optimize and refine their original deck.

Demo page: https://cr-ledger.pages.dev/
Open the demo in your browser to quickly inspect the UI. Please file issues for feedback.

---

## Concept

CR_ledger is designed with the following principles:

- Prioritize a player's own match data over general meta or tiers
- Provide investigation material without making absolute claims when sample sizes are small
- Focus on improving deck composition rather than play techniques
- Support mastery of original (non-template) decks

The tool aims to clarify "what to think about" rather than prescribe a single change.

---

## Capabilities

CR_ledger collects a target player's battlelog and performs analyses such as:

- Visualizing opponent card and deck trends
- Comparing win rates per deck and recent win rates
- Computing conditional win rates against specific cards
- Co-occurrence analysis for problematic card combinations
- Providing assessments, weaknesses, and improvement candidates for deck-tuning phases

These outputs are intended as supporting information to help answer "why am I losing" and "where structural weaknesses lie." 

---

## How it differs from existing apps

Unlike general analysis or deck-sharing apps (Stats Royale, DeckShop Pro, deckai, etc.), CR_ledger:

- Can accumulate a single player's battlelog over time
- Emphasizes individual optimization rather than generally-strong decks
- Assumes original decks rather than template decks
- Focuses on deck composition improvements rather than play analysis
- Aims to support decision-making rather than make definitive statistical claims

---

## Repository structure

The repository contains both backend and frontend code:

```
/
├─ backend/  # API / analysis logic
├─ frontend/ # Web UI
└─ docs/     # Design and specification documents
```

---

## Tech stack (summary)

- Frontend: React
- Backend: Cloudflare Workers
- Database: Cloudflare D1 (SQLite)

---

## Data

CR_ledger uses the official Clash Royale API's battlelog and cards as the only data sources.

- It does not record card placements, timings, or player input logs
- All analyses are based on battlelog-derived information
- A database is required; the app does not run without a DB

## API documentation

The REST/Worker API specification is documented in this repository:

- docs/api.md

## DB documentation

Database design details (Cloudflare D1 / SQLite) are consolidated here:

- docs/db/notes.md — contains schema, ER diagrams, sample data, and seed file locations. Refer to it for implementation and analysis.

---

## Setup (summary)

To run this application you need:

- Cloudflare Workers runtime
- Cloudflare D1 database
- Clash Royale API access token

Detailed setup steps will be provided in docs/.

---

## Target users

CR_ledger is intended for players who:

- Prefer using their own deck over template decks
- Want to master a single deck
- Prefer data-driven review of wins/losses
- Are willing to iteratively improve deck composition
- Value personal-fit recommendations over generic meta advice

---

## License

TBD
