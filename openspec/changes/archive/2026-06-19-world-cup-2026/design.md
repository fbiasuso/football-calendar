# Design: World Cup 2026 Section

## Technical Approach

Add a "Mundial 2026" section via state-based tab navigation (no router). Fetch standings + rounds from API-Football on mount, cache in Zustand. Render a 4×3 group standings grid and a R32 bracket with a pure-function third-place simulator. World Cup matches flow through the existing match pipeline as another league entry.

## Architecture Decisions

### Decision: Navigation — State-based tabs vs React Router

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React Router | Router overhead for two views; current app has none — inconsistency | ❌ Rejected |
| Zustand `currentView` | Zero deps, matches existing pattern, trivially simple | ✅ **Chosen** |

### Decision: Simulation — Pure function vs store action

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Store action `simulateR32()` | Reads/writes store in one call, but mixes concerns (pure computation in state layer) | ❌ Rejected |
| Pure function `thirdPlaceRanker(groups)` + `setWcBracket` setter | Testable with zero mocks, separates computation from state, component drives flow | ✅ **Chosen** |

`thirdPlaceRanker.js` exports a pure function. Bracket component reads `wcStandings` from store, calls ranker on click, stores result via `setWcBracket`.

### Decision: simulateR32 loading state

Sync computation is too fast to show a spinner. The "loading" state maps to: button disabled while `wcStandings` is null (loading/error). On click, set `isSimulating = true`, schedule computation via `setTimeout(0)` to yield one frame, then set results and reset flag.

### Decision: World Cup data in LeagueFilter

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `mundial` group in `LEAGUE_GROUPS` | Consistent with existing pattern; WC matches appear in main list | ✅ **Chosen** |
| Hardcode WC always visible | Inconsistent filtering UX | ❌ Rejected |

### Decision: Cache strategy for WC data

Standings and rounds are session-only (no localStorage). The `useWorldCup` hook caches in Zustand; re-fetches on remount if stale > 5 min. This matches the proposal's "cache within session only" constraint.

## Data Flow

```
useWorldCup hook (mount)
  │
  ├── fetchStandings(1, 2026) ──► apiFootball.getStandings()
  │                                   │
  │                                   ▼
  │                              Zustand wcStandings
  │                                   │
  │                                   ├──► GroupStandings
  │                                   │       └── GroupTable × 12
  │                                   │
  │                                   └──► Bracket (reads for simulation)
  │                                            │
  │                                            ▼
  │                                    Simular click → thirdPlaceRanker(groups)
  │                                            │
  │                                            ▼
  │                                    Zustand wcBracket ← setWcBracket()
  │                                            │
  │                                            ▼
  │                                    Bracket re-renders with pairings
  │
  └── fetchRounds(1, 2026) ──► Zustand wcRounds
                                     (reserved for future knockout bracket)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/api/apiFootball.js` | Modify | Add `getStandings(leagueId, season)` and `getRounds(leagueId, season)` |
| `src/api/adapter.js` | Modify | Export new functions through adapter interface |
| `src/utils/leagueConfig.js` | Modify | Add `'World Cup 2026': 1` to IDs; add `mundial` group to `LEAGUE_GROUPS`; add to `DEFAULT_SELECTED_LEAGUES` |
| `src/store/useAppStore.js` | Modify | Add `currentView`, `wcTab`, `wcStandings`, `wcRounds`, `wcBracket` fields + setters |
| `src/App.jsx` | Modify | Import NavBar, `currentView`; conditionally render `MatchListView` \| `WorldCupPage` |
| `src/components/NavBar/NavBar.jsx` | Create | Two tab buttons: "Partidos" / "Mundial 2026". Reads/sets `currentView` |
| `src/pages/WorldCupPage/WorldCupPage.jsx` | Create | Container with sub-tab switcher. Reads `wcTab`, renders GroupStandings \| Bracket |
| `src/pages/WorldCupPage/SubTabBar.jsx` | Create | Sub-tab bar: "Grupos" / "Llaves". Reads/sets `wcTab` |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | Create | 4×3 responsive grid of GroupTable components. Loading/error/empty states |
| `src/pages/WorldCupPage/GroupStandings/GroupTable.jsx` | Create | Single group table: Pos, logo+team, Pts, PJ, G, E, P, GF, GC, DG. Green tint on 1st |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | Create | 16 R32 matchups + Simular button. Reads standings, runs simulation, renders results |
| `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.js` | Create | Pure function: rank 12 3rd-place teams, select top 8, assign per FIFA candidate-group rules |

## Interfaces / Contracts

### thirdPlaceRanker(input) → output

```js
// Input: array of 12 group objects
[
  {
    group: 'A',  // 'A'..'L'
    teams: [
      { rank: 1, name: 'Brasil', logo: '...', points: 9, played: 3,
        wins: 3, draws: 0, losses: 0, goalsFor: 8, goalsAgainst: 1, goalDiff: 7 },
      // ... 3 more teams (rank 2, 3, 4)
    ]
  }
  // ... 11 more groups
]

// Output: array of 8 slot assignments, plus 8 fixed group-winner matchups
{
  fixedMatchups: [
    { id: 'R32-1', homeGroup: '1A', awayGroup: '2C' },
    { id: 'R32-2', homeGroup: '1B', awayGroup: '2D' },
    { id: 'R32-3', homeGroup: '1C', awayGroup: '2A' },
    { id: 'R32-4', homeGroup: '1D', awayGroup: '2B' },
    { id: 'R32-5', homeGroup: '1E', awayGroup: '2G' },
    { id: 'R32-6', homeGroup: '1F', awayGroup: '2H' },
    { id: 'R32-7', homeGroup: '1G', awayGroup: '2E' },
    { id: 'R32-8', homeGroup: '1H', awayGroup: '2F' },
  ],
  thirdPlaceSlots: [
    {
      slotIndex: 0,       // 0..7
      matchupId: 'R32-9', // faces 1I
      opponentGroup: '1I',
      team: { name: '...', logo: '...', group: 'A', points: 4, ... } | null,
      isSimulated: true | false,
      candidateGroups: ['A', 'B', 'C', 'D'],
    }
    // ... 7 more slots
  ]
}
```

### API responses

```js
// getStandings(1, 2026) → {
//   response: [
//     {
//       league: { id: 1, name: 'World Cup', season: 2026 },
//       standings: [
//         // One ranking array per group
//         [
//           { rank: 1, team: { id, name, logo }, points: 9, all: { played, win, draw, lose, goals: { for, against } } },
//           // ... rank 2, 3, 4
//         ]
//       ]
//     }
//   ]
// }
```

### Store shape additions

```js
{
  currentView: 'matches' | 'worldcup',   // default: 'matches'
  wcTab: 'grupos' | 'llaves',            // default: 'grupos'
  wcStandings: null | { groups: [...], lastFetched: timestamp },
  wcRounds: null | string[],
  wcBracket: null | { fixedMatchups: [...], thirdPlaceSlots: [...] },

  // Setters
  setCurrentView: (view) => {},
  setWcTab: (tab) => {},
  setWcStandings: (standings) => {},
  setWcRounds: (rounds) => {},
  setWcBracket: (bracket) => {},
}
```

### thirdPlaceRanker algorithm pseudocode

```
1. Extract 3rd-place team from each group (teams[2])
2. Sort by (points DESC, goalDiff DESC, goalsFor DESC)
3. Take top 8
4. Build 8 slot assignments:
   Slots 0-3 (face 1I, 1J, 1K, 1L):
     candidateGroups = [A, B, C, D]
     Assign best-ranked eligible team not in a group that'd self-match
   Slots 4-7 (face 1A/B/C/D or 1E/F/G/H):
     candidateGroups = [E, F, G, H]
     Assign best-ranked eligible team not in a group that'd self-match
5. Return ordered assignments
```

Constraint: a team cannot be assigned to a slot facing its own group's group winner. For slots 0-3 (faces winner of groups I-L), no self-match conflict exists since I-L ≠ A-D. For slots 4-7 (faces winner of groups from A-H), teams from E-H must not face a winner from their own group.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `thirdPlaceRanker` — standard sort, tiebreakers (GD, GF), self-match constraint, <8 teams | Pure function, zero mocks. 4-5 test cases covering all branches |
| Unit | `GroupTable` rendering — header, stats, leader highlight | Render with fixture data, assert text + class presence |
| Integration | `getStandings` / `getRounds` parsing — API response → internal shape | Mock `fetchWithRetry`, verify normalization |
| Integration | Store flow — `fetchWcStandings` → `wcStandings` set → GroupStandings reads | Render WorldCupPage with mocked API, assert GroupTable renders |

## Migration / Rollout

No migration required. New feature is additive — all existing views and data unchanged. WC league config addition is immediate; old cached match data without WC league ID is unaffected.

## Open Questions

- [ ] Confirm API-Football standings response structure for `/standings?league=1&season=2026` — specifically whether each group is a separate item in the response array vs. a single array with nested groups
- [ ] Verify R32 third-place candidate-group mapping from official FIFA 2026 regulations — will pin during implementation via a config constant in `thirdPlaceRanker.js`
- [ ] Confirm `apiFootball.js` `fetchWithRetry` handles the `x-apisports-key` header correctly for new endpoints (same proxy path applies)
