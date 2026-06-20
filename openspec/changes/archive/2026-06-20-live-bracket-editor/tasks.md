# Tasks: Live Bracket Editor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 465–685 (incl. tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Foundation → ThirdPlaceTable → Bracket pick'em → Tests |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DAG + Engine + Store | PR 1 | bracketGraph, bracketEngine, wcPicks store. ~200 new lines. Base → main. |
| 2 | ThirdPlaceTable | PR 2 | New component + GroupStandings wiring. ~105 lines. Depends on PR 1. |
| 3 | Bracket auto-compute + pick'em | PR 3 | Bracket.jsx refactor, WorldCupPage rankerResult. ~265 lines. Depends on PR 2. |
| 4 | Tests | PR 4 | Unit + integration for all new/modified modules. ~220 lines. Depends on PR 3. |

## Phase 1: Foundation (DAG + Engine + Store)

- [x] **1.1** Create `src/pages/WorldCupPage/Bracket/bracketGraph.js` — export `TOURNAMENT_GRAPH` (31 nodes, each with `round`, `feedsInto`, `as`) and `R32_PAIRS` (8 pairs in visual order: M74+M77, M73+M75, M83+M84, M81+M82, M76+M78, M79+M80, M86+M88, M85+M87). Verify acyclic (31 entries).
- [x] **1.2** Create `src/pages/WorldCupPage/Bracket/bracketEngine.js` — export pure `resolveBracket(picks, graph, standings, rankerResult)` that resolves R32 from standings+rankerResult, applies user picks, propagates through DAG topologically, returns `{ matchups }` with `winner`, `isPending` per node. 3rd-place slots sourced from `rankerResult`.
- [x] **1.3** Modify `src/store/useAppStore.js` — add `wcPicks: {}` (persisted via `partialize`), `setWcPick(matchupId, side)` that registers pick and clears downstream picks by walking `TOURNAMENT_GRAPH`, `clearWcPicks()` that resets all.

## Phase 2: ThirdPlaceTable

- [x] **2.1** Create `src/pages/WorldCupPage/GroupStandings/ThirdPlaceTable.jsx` — receives `standings`, invokes `thirdPlaceRanker(standings)`. Renders 12 rows sorted by ranking: #, Logo+Team, Group, Pts, PJ, G, E, P, GF, GC, DG, "Avanza?" (✓ + slot name for top 8, ✗ for bottom 4). Renders nothing if standings are empty/null.
- [x] **2.2** Modify `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` — import and render `<ThirdPlaceTable standings={standings} />` below the 4×3 grid.

## Phase 3: Bracket Auto-compute + Pick'em Editor

- [x] **3.1** Modify `src/pages/WorldCupPage/WorldCupPage.jsx` — compute `rankerResult = useMemo(() => standings ? thirdPlaceRanker(standings) : null, [standings])` and pass as prop to both `GroupStandings` and `Bracket`.
- [x] **3.2** Modify `src/pages/WorldCupPage/Bracket/Bracket.jsx` — replace `handleSimulate` + `setWcBracket` with `useMemo([standings])` auto-computation. `wcBracket` becomes override layer only. Replace "Simular" button with "Resetear picks" calling `clearWcPicks()`, disabled when `Object.keys(wcPicks).length === 0`.
- [x] **3.3** Same file — implement pick'em modal: click R32 cells → modal with two clickable team cards (highlighted border + checkmark on selection), match info below. Use `resolveBracket(wcPicks, TOURNAMENT_GRAPH, standings, rankerResult)` for all rounds. R16+ cells read-only (show propagated winners or "Pendiente"). Small indicator dot on user-picked teams. Modal not openable on R16+ until both feeds resolved.

## Phase 4: Testing

- [x] **4.1** Unit tests for `bracketGraph.js` (18 tests: 31 nodes, acyclic, edge targets, round progression, R32_PAIRS, validateGraph) and `bracketEngine.js` (18 tests: propagation, picks, downstream cleanup, empty/null standings, third-place slots).
- [x] **4.2** Unit tests for `ThirdPlaceTable.jsx` (10 tests: 12 rows, ✓/✗, team names, group letters, ranking number, slot names, headers, empty/null).
- [x] **4.3** Integration tests for `Bracket.jsx` (12 tests: loading/empty states, team display, pick controls, modal interaction, setWcPick called on card click).
