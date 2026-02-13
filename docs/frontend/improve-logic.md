# Improve page logic (frontend)

This document explains how `frontend/src/pages/ImprovePage.tsx` builds Improve UI.

## Data sources

- `GET /api/decks/{my_deck_key}/offense/counters`
- `GET /api/decks/{my_deck_key}/defense/threats`
- `GET /api/trend/{player_tag}/traits`
- `GET /api/decks/{my_deck_key}/summary`
- `GET /api/trend/win-conditions?player_tag=...&last=200`

All endpoints are fetched in parallel after player/deck are selected.

## Information architecture (fixed 3 blocks)

1. **Issue**: one priority conclusion
2. **Why**: one chart area (tabbed)
3. **Action**: 2-3 non-card-specific plans

## Main flow

### 1) Issue selection

- Build attack issue from `offense.counters.traits`.
- Build defense issue from `defense.threats`.
- Do **not** compare offense trait and defense card directly in one candidate list.
- Compute unified score for both sides:

`expected_loss = battles_with_element * max(0, baseline_win_rate - win_rate_given)`

- Exclude always-on traits from issue candidates (`encounter_rate > 0.85`).
- Pick top attack issue by expected loss.
- Pick top defense issue by expected loss.
- Final priority (`Attack` or `Defense`) is whichever has larger expected loss.

### 2) Why (evidence)

- Tab A: `環境×攻め阻害` scatter for offense traits.
  - X: trend `mean_count`
  - Y: `max(0, baseline_win_rate - win_rate_given)`
  - Dot size: `battles_with_element`
- Tab B: `守り脅威` bar chart for top defense cards.
  - Value: expected loss
  - Sub-info: encounter rate
- Small background line: trend win-condition top 3.

### 3) Action generation

- Action plans are generated only when deck summary suggests shortage.
- Use `summary.deck_traits` / `summary.cards` as shortage checks.
- Plans are category-level wording (non-causal, non card-fixed), e.g.:
  - action cancel resistance
  - AoE category
  - receiving options against building-focused pressure
- Show up to 3 plans.
- CTA `この方針で検討` pins one plan as memo.

## Notes

- This is a decision-support heuristic, not a causal model.
- Copy intentionally avoids causal certainty.
