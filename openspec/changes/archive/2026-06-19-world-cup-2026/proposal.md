# Proposal: World Cup 2026 Section

## Intent

Add a dedicated "Mundial 2026" section to the Football Calendar SPA. Users currently see daily matches — after this change they can also browse group standings, the Round of 32 bracket with simulated third-place matchups, and find WC fixtures integrated into the main match list. The World Cup is a high-traffic, time-sensitive event that justifies a first-class navigation tab instead of treating it as "just another league."

## Scope

### In Scope
- **NavBar** with two top-level tabs: "Partidos" (default) / "Mundial 2026"
- **World Cup Page** with two sub-tabs: "Grupos" / "Llaves"
- **Grupos tab**: 4×3 grid of group tables (12 groups A–L, columns: Pos, team+logo, Pts, PJ, G, E, P, GF, GC, DG)
- **Llaves tab**: R32 bracket showing 16 official matchups, with a "Simular" button that computes third-place pairings via FIFA's greedy algorithm
- **Third-place ranker**: rank 12 third-placed teams (pts > GD > GF), select top 8, assign using FIFA's candidate-group sets
- **Simulation badge**: unplayed simulated matchups show a "SIMULACIÓN" badge and the predicted pairing
- **API integration**: `GET /standings?league=1&season=2026` (standings), `GET /fixtures/rounds?league=1&season=2026` (round names)
- **League config**: add "World Cup 2026" (league ID 1) to `LEAGUE_GROUPS` and `DEFAULT_SELECTED_LEAGUES`
- **Store state**: `currentView: 'matches' | 'worldcup'`, `wcTab: 'grupos' | 'llaves'`, WC data cache fields in Zustand store
- **Match list integration**: WC fixtures filtered and displayed alongside other leagues in the main "Partidos" view

### Out of Scope
- React Router (keep state-based navigation)
- Knockout rounds beyond R32 (quarters, semis, final — deferred)
- World Cup data persistence to localStorage (cache within session only)
- Print/share bracket functionality

## Capabilities

### New Capabilities
- `wc-standings`: Fetch and display 12 group standings tables in a 4×3 grid, with team logos and full stats. Data sourced from `/standings?league=1&season=2026`.
- `wc-bracket`: Render the 16-match R32 bracket. On "Simular" click, compute third-place assignments using FIFA's algorithm. Show simulated pairings with a visual badge. Non-simulated matches link to live fixture data.
- `app-navigation`: State-based tab switching (`matches` / `worldcup`) in the Zustand store. Sub-tab state for the WC page. No router dependency.

### Modified Capabilities
None — existing capabilities (match list, scores, aggregate, filtering, sorting, date nav) preserve current spec-level behavior. WC matches flow through the normal match pipeline as another league.

## Approach

1. **Store**: Add `currentView`, `wcTab`, `wcStandings`, `wcRounds` to Zustand store. Add setters and a `simulateR32()` action.
2. **API layer**: Add `getStandings(leagueId, season)` and `getRounds(leagueId, season)` to `apiFootball.js`. Export through `adapter.js`.
3. **League config**: Add `'World Cup 2026': 1` to `API_FOOTBALL_LEAGUE_IDS`, add group in `LEAGUE_GROUPS`, add to defaults.
4. **NavBar**: New `src/components/NavBar/` with two tab buttons. Rendered in `App.jsx` header. Controls `currentView`.
5. **WorldCupPage**: New `src/pages/WorldCupPage/` container component with sub-tab switcher.
6. **GroupStandings**: New `src/pages/WorldCupPage/GroupStandings/` — renders 4×3 grid of `GroupTable` components.
7. **Bracket**: New `src/pages/WorldCupPage/Bracket/` — renders R32 matchups, "Simular" button, third-place logic.
8. **App.jsx**: Conditionally render `<MatchListView>` or `<WorldCupPage>` based on `currentView`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/store/useAppStore.js` | Modified | Add `currentView`, `wcTab`, standings/rounds state, `simulateR32()` |
| `src/api/apiFootball.js` | Modified | Add `getStandings()`, `getRounds()` |
| `src/api/adapter.js` | Modified | Export new API functions |
| `src/utils/leagueConfig.js` | Modified | Add "World Cup 2026" league entry |
| `src/App.jsx` | Modified | Add NavBar, conditional view rendering |
| `src/components/NavBar/NavBar.jsx` | **New** | Tab navigation component |
| `src/pages/WorldCupPage/WorldCupPage.jsx` | **New** | Container with sub-tabs |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | **New** | 4×3 standings grid |
| `src/pages/WorldCupPage/GroupStandings/GroupTable.jsx` | **New** | Single group table |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | **New** | R32 bracket + simulation |
| `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.js` | **New** | Third-place ranking + FIFA assignment algorithm |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FIFA's candidate-group assignment algorithm is complex to implement correctly | Medium | Write dedicated unit tests for `thirdPlaceRanker.js` against all edge cases (fewer than 8 third-place teams, tiebreakers) |
| API-Football standings endpoint format may differ from groups A–L expectation | Low | Verify response structure on first integration test; adapt parsing |
| WC fixtures pollute main match list (100 req/day limit) | Medium | WC fixtures share the same daily cache; no extra calls beyond existing `getMatches` |
| Group standings for future dates show empty data pre-tournament | Low | Display "No hay datos" empty state gracefully |

## Rollback Plan

Revert `useAppStore.js`, `apiFootball.js`, `adapter.js`, `leagueConfig.js`, `App.jsx`. Delete `src/components/NavBar/` and `src/pages/WorldCupPage/`. No data migration — cache expires naturally.

## Dependencies

- API-Football key must have access to league ID 1 (World Cup) — confirmed working
- API-Football must have season 2026 data populated for `/standings` and `/fixtures`

## Success Criteria

- [ ] NavBar renders two tabs, switching between match list and WC page
- [ ] GroupStandings renders 12 group tables in a 4×3 grid with correct data from API
- [ ] Bracket renders 16 R32 matchups with correct group letters
- [ ] "Simular" computes valid third-place pairings per FIFA rules
- [ ] Simulated matchups display "SIMULACIÓN" badge
- [ ] World Cup matches appear in the main "Partidos" match list
- [ ] League filter includes "World Cup 2026" checkbox (pre-selected)
- [ ] Empty/loading/error states handled for all WC views
