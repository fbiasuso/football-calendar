# Tasks: Bracket Pick'em Complete

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High
```

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Store + Engine + RoundState | PR 1 | Base = main. Independent foundation, ~50 lines |
| 2 | Bracket.jsx UI (SlotPoolSelector, R32/R16+/locked modals, dispatch) | PR 2 | Base = main. Bulk of new code, ~350 lines |
| 3 | Unit + integration tests | PR 3 | Base = main. Requires PR 1 + PR 2 code, ~100 lines |

## Phase 1: Store + Engine (Foundation)

- [x] 1.1 Add `wcSlots: {}` state + `setWcSlot(slotId, team)` action in `src/store/useAppStore.js` — clears downstream picks per DAG
- [x] 1.2 Add `clearAllWcSlots()` action in store
- [x] 1.3 Extend `partialize` to persist `wcSlots` alongside `wcPicks`
- [x] 1.4 Add 5th `wcSlots` param to `resolveBracket()` in `bracketEngine.js` — per-slot check before `getTeamByRank`
- [x] 1.5 Add 3rd `wcSlots` param to `computeRoundStates()` in `Bracket.jsx` — R32 complete requires 32 slots filled + 16 R32 picks

## Phase 2: Bracket UI (Core)

- [x] 2.1 Add `SlotPoolSelector` in `Bracket.jsx` — fixed pool (4 teams per R32_CONFIG group) + third-place pool (from `THIRD_PLACE_CANDIDATES` with arrow cycling)
- [x] 2.2 Build `renderR32Modal` — dual `SlotPoolSelector` panels, active-side toggle, VS divider, group indicator + arrows
- [x] 2.3 Build `renderR16PlusModal` — 2-team click-to-pick cards (reused for R16/QF/SF/Final)
- [x] 2.4 Build `renderLockedModal` — read-only teams, logos, date, group source, winner
- [x] 2.5 Replace `renderModal` dispatcher: R32 → `renderR32Modal`, R16+ editing → `renderR16PlusModal`, locked → `renderLockedModal`
- [x] 2.6 Update R32 cell rendering — read from `wcSlots[id + '-home'|away]` with "Elegir Equipo" placeholder
- [x] 2.7 Update reset handler — call `clearAllWcSlots()` + `clearWcPicks()`, count includes `wcSlots`
- [x] 2.8 Wire `setWcSlot`: active-side click → slot + pick; inactive-side → slot only

## Phase 3: Tests (Verification)

- [x] 3.1 Update `bracketRoundState.test.js` — add wcSlots arg to calls; test: 32 slots + 16 picks → R32 completed; 32 slots + 15 picks → R32 active
- [x] 3.2 Update `bracketEngine.test.js` — test: wcSlots overrides standings; empty falls through; partial mixed; no arg uses standings
- [x] 3.3 Update `Bracket.integration.test.jsx` — add wcSlots/setWcSlot/clearAllWcSlots to mock; test: pool teams, slot+pick assign, arrow cycling, locked read-only, 32-slot unlock
