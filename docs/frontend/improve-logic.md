# Improve page logic (frontend)

This document explains how `frontend/src/pages/ImprovePage.tsx` builds Improve UI.

## Data sources

- `GET /api/decks/{my_deck_key}/offense/counters`
- `GET /api/decks/{my_deck_key}/defense/threats`
- `GET /api/trend/{player_tag}/traits`
- `GET /api/decks/{my_deck_key}/summary`
- `GET /api/trend/win-conditions?player_tag=...&last=200`

All endpoints are fetched in parallel.

## Information architecture (fixed)

1. **Issue**: one final priority
2. **Why**: one evidence area (tab switch)
3. **Action**: 2-3 plans with verification axis

Section titles are intentionally short in UI: `Issue`, `Why`, `Action`.

## 1) Issue selection

Attack/Defense are ranked separately first, then final priority is chosen.

Unified score:

`expected_loss = battles_with_element * max(0, baseline_win_rate - win_rate_given)`

Issue candidate filters:

- `encounter_rate >= 0.15`
- `encounter_rate <= 0.85` (exclude always-on traits)
- `delta_vs_baseline <= -0.05`
- `battles_with_element >= 20`
- `trend.mean_count <= 2.2` (for attack traits)

UI copy for issue emphasizes interpretation:

- e.g. `攻撃が「スタン系」で止められやすい（勝率 -6.7%）`
- show concrete example cards for traits (from top offense counter cards)

## 2) Why block

Tabbed view:

- Attack tab: horizontal compare bars (top traits)
  - environment average count (`trend.mean_count`)
  - your deck count (`summary.deck_traits`)
  - plus `expected_loss` and `delta_vs_baseline`
- Defense tab: top threat bars
  - main value: `expected_loss`
  - sub info: `delta_vs_baseline`, `encounter_rate`

Small context line:

- trend win-condition top 3 cards.

## 3) Action generation

Plans are category-level and shortage-based (non-causal, non card-fixed).

- stun/immobilize shortage
- AoE category shortage
- defense receiving slot shortage (building/high-DPS role)
- fallback review plan if no shortage is explicit

Each plan includes:

- why now
- current state
- **next 5 battles verification metrics**

CTA uses short label `Select` to avoid wrapping on small screens.

## Progressive explanation (accordion)

Each section has a collapsed `<details>` guide:

- `How to read Issue / EL`
- `How to read Why`
- `What to keep / cut`

This keeps default UI concise while still explaining EL and chart interpretation for users who need it.

## Notes

- This is decision support, not causal proof.
- Wording intentionally avoids causal certainty.
