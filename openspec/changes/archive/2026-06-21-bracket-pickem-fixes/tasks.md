# Tasks: Bracket Pick'em Fixes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Locked Mode Filter (Bracket.jsx)

- [x] 1.1 Add `effectivePicks`/`effectiveSlots` derived variables in `Bracket` component body: `effectivePicks = bracketMode === 'locked' ? {} : wcPicks`, `effectiveSlots = bracketMode === 'locked' ? null : wcSlots`
- [x] 1.2 Pass `effectivePicks`/`effectiveSlots` to `resolveBracket()` and `computeRoundStates()` instead of raw `wcPicks`/`wcSlots`

## Phase 2: R32 Modal 2-Step Redesign (Bracket.jsx)

- [x] 2.1 Add local state to `R32Modal`: `step` (`'teams' | 'winner'`), `expandedHome`, `expandedAway` — initialize from existing `wcSlots` on mount; remove `activeSide` state
- [x] 2.2 Update `SlotPoolSelector` props: remove `isActive`/`onToggle`, add `expanded` (boolean), `onChangeTeam` (callback), `step` (`'teams' | 'winner'`)
- [x] 2.3 Rewrite `SlotPoolSelector` render: when `isExpanded` → show full-size team card + "Cambiar equipo" button, hide other 3 cards; when not expanded → show 4 small cards, third-place arrows visible
- [x] 2.4 Rewrite `R32Modal` handler logic: team click in step `'teams'` → save slot + set expanded; when both sides have a team → transition to step `'winner'`; winner click → save pick + close modal
- [x] 2.5 Update `R32Modal` footer text per step: step `'teams'` → "Elegí los equipos del cruce"; step `'winner'` → "Elegí el ganador del cruce"

## Phase 3: Test Updates (Bracket.integration.test.jsx)

- [x] 3.1 Update existing R32 modal tests for new modal structure (no `isActive`/`onToggle`, no `Local/Visitante` buttons)
- [x] 3.2 Add test: slot set expands card, shows "Cambiar equipo" button
- [x] 3.3 Add test: third-place arrow buttons hidden after team selection
- [x] 3.4 Add test: both slots set auto-advances step to `'winner'`
- [x] 3.5 Add test: clicking team in `'winner'` step calls `setWcPick` + modal closes
- [x] 3.6 Add test: re-opening modal with existing slots initializes winner step
