# CR_ledger

CR_ledger is an analytics application focused on Clash Royale that continuously collects an individual player's battlelog to help optimize and refine that player's original deck.

**Demo page:** https://cr-ledger.pages.dev/  
Open the demo in a browser to quickly check behavior and UI. Please report feedback or bugs via issues.

---

## Concept

CR_ledger is designed with the following principles in mind:

- Prioritize an individual player's real match data over general theory or meta tiers
- Present findings as materials for consideration rather than definitive claims when sample sizes are small
- Focus on improving deck composition rather than play-by-play actions
- Support mastering an original deck rather than promoting template lineups

This tool is intended not to decide "what to swap" for you, but to clarify "what to think about."

---

## What it does

CR_ledger collects a specific player's battlelog and provides the following analyses:

- Visualization of opponent card and deck trends
- Comparison of win rates by deck and recent win rates
- Conditional win rate calculations for specific cards
- Co-occurrence analysis to find troublesome card combinations
- Overall assessment, weaknesses, and candidate improvements to guide deck improvement phases

All outputs are provided as supporting information to help answer "why am I losing" and "where are the structural weaknesses."

---

## Differences from existing apps

CR_ledger differs from general analysis and deck sites (e.g., Stats Royale, DeckShop Pro, deckai) in these ways:

- Long-term accumulation of a single player's battlelog
- Emphasis on personal optimization over universally strong decks
- Assumes original deck use rather than template promotion
- Focused on deck composition improvement rather than play analysis
- Intended as decision-support rather than statistical proclamation

---

## Repository layout

This repository contains both backend and frontend code.

```
/
├─ worker-cr-ledger/  # API / analysis logic
├─ cr-ledger-pwa/     # Web UI
└─ docs/              # Design and specification documents
```

---

## Tech stack (overview)

- Frontend: (example) React
- Backend: Cloudflare Workers
- Database: Cloudflare D1 (SQLite)

*This repository does not include DB schema files or real data.*

---

## Data

CR_ledger uses the Clash Royale official API's battlelog as its sole data source.

- It does not handle card placement, timing, or input logs
- All analyses are based solely on battlelog-derived information
- A database is required; the app will not function without one

## DB documentation

Database design details are documented below (Cloudflare D1 / SQLite):

- [docs/db/schema.md](docs/db/schema.md)  
  Table definitions, column meanings, constraints, and index explanations (primary documentation).  
  NOTE: PRAGMA outputs (table_info / foreign_key_list / index_list) will be appended to the end of this file.

- [docs/db/schema.er.md](docs/db/schema.er.md)  
  ER diagram rendered with Mermaid for an overall view.

- [docs/db/notes.md](docs/db/notes.md)  
  Design rationale, trade-offs, and "intentional omissions" notes.

---

## Setup (summary)

To run this application you will need:

- A Cloudflare Workers execution environment
- A Cloudflare D1 database
- A Clash Royale API access token

Detailed setup steps will be documented under `docs/`.

---

## Intended users

CR_ledger is aimed at players who:

- Prefer using their own deck over template decks
- Want to master a single deck in depth
- Wish to review wins and losses using data rather than intuition
- Are focused on improving deck composition thoughtfully
- Value "what works for me" over general meta advice

---

## License

TBD
