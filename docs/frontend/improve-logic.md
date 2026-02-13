# Improve page logic (frontend)

This document explains how `frontend/src/pages/ImprovePage.tsx` builds Improve UI.

## Data sources

- `GET /api/decks/{my_deck_key}/offense/counters`
- `GET /api/decks/{my_deck_key}/defense/threats`
- `GET /api/trend/{player_tag}/traits`

All three are fetched in parallel after player/deck are selected.

## Main flow

1. **Primary issue (single highest priority)**
   - Candidate A: top offense trait
   - Candidate B: top defense threat card
   - Compare by `threat_score`
   - Highest one becomes `primaryIssue`

2. **Improvement plans (max 3)**
   - Add AoE plan when trend suggests swarm/bait pressure
   - Add building plan when top defense threat exists
   - Add stun/immobilize rebalance plan when offense top trait suggests it
   - If no plan can be generated, add replay-review fallback plan

3. **Next candidates**
   - Show up to 2 lower-priority candidates from top defense card / top trend trait

## UI behavior

- Step 1 shows one issue, risk bar, and key numbers.
- Step 2 shows up to 3 plan cards with simple decision buttons:
  - "この方向で検討する"
  - "今は保留"
- Supporting numbers stay in `<details>` to reduce cognitive load.
- Copy explicitly keeps non-causal phrasing (correlation-based suggestion).

## Notes

- This is a decision-support heuristic, not a causal model.
- Thresholds and wording are intentionally simple for quick action.
