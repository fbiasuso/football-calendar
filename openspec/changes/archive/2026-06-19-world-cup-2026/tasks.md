# Tasks: World Cup 2026 Section

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~685 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation + NavBar) → PR 2 (Standings + Ranker) → PR 3 (Bracket + Integration) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + NavBar (~165 lines) | PR 1 | League config, API, store, NavBar, SubTabBar |
| 2 | Standings + Ranker (~230 lines) | PR 2 | GroupTable, GroupStandings, thirdPlaceRanker |
| 3 | Bracket + Integration (~260 lines) | PR 3 | Bracket, useWorldCup hook, WorldCupPage, App.jsx |

Base branch for all PRs: `main`

---

## Phase 1: Foundation

- [x] **T1**: Add `'World Cup 2026': 1` to `API_FOOTBALL_LEAGUE_IDS`, add `mundial` group to `LEAGUE_GROUPS`, add to `DEFAULT_SELECTED_LEAGUES` in `src/utils/leagueConfig.js`
- [x] **T2**: Add `getStandings(leagueId, season)` and `getRounds(leagueId, season)` to `src/api/apiFootball.js` (using `fetchWithRetry`, normalize response to per-group structure). Export through `src/api/adapter.js` with lazy import pattern
- [x] **T3**: Add `currentView: 'matches'`, `wcTab: 'grupos'`, `wcStandings`, `wcRounds`, `wcBracket` fields + `setCurrentView`, `setWcTab`, `setWcStandings`, `setWcRounds`, `setWcBracket` setters to `src/store/useAppStore.js`. Exclude WC data from localStorage persistence.

## Phase 2: Core Components

- [x] **T4**: Create `src/components/NavBar/NavBar.jsx` with two tab buttons ("Partidos" / "Mundial 2026"), reads `currentView` and `setCurrentView` from store, active tab visual indicator
- [x] **T5**: Create `src/pages/WorldCupPage/SubTabBar.jsx` with "Grupos" / "Llaves" buttons that read/set `wcTab` from store
- [x] **T6**: Create `src/pages/WorldCupPage/GroupStandings/GroupTable.jsx` (single group table: Pos, logo+team, Pts, PJ, G, E, P, GF, GC, DG; green tint on rank 1) and `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` (4×3 responsive grid, loading/error/empty states)
- [x] **T7**: Create `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.js` — pure function: rank 12 third-placed teams (pts > GD > GF), select top 8, assign to 8 slots using official FIFA candidate-group sets (M74, M77, M79, M80, M81, M82, M85, M87), enforces self-match constraint
- [x] **T8**: Create `src/pages/WorldCupPage/Bracket/Bracket.jsx` — 16 R32 matchups (8 fixed + 8 third-place slots), "Simular" button (disabled when no standings, calls `thirdPlaceRanker` on click via `setTimeout(0)`), shows "SIMULACIÓN" badge + assigned team for simulated slots

## Phase 3: Integration

- [x] **T9**: Create `src/hooks/useWorldCup.js` — fetches standings and rounds on mount via API adapter, caches in Zustand, re-fetches if stale > 5 min, exposes `{ standings, rounds, loading, error, refetch }`
- [x] **T10**: Create `src/pages/WorldCupPage/WorldCupPage.jsx` (container that reads `wcTab`, renders GroupStandings or Bracket via SubTabBar, uses `useWorldCup` hook). Modify `src/App.jsx` — import NavBar, import `currentView` from store, conditionally render `<MatchListView>` or `<WorldCupPage>`
