# Design: Bracket Pick'em Complete

## Technical Approach

Add `wcSlots` state (32 slot IDs → team or null) persisted via Zustand `partialize`. Replace the existing single-modal winner-picker with a unified `MatchupModal` that renders two `SlotPoolSelector` panels — each sourcing teams from standings groups with cycling for third-place slots. Active-side click assigns the slot AND sets the winner; inactive-side click assigns only. `resolveBracket` gains an optional `wcSlots` param that overrides standings when present. `computeRoundStates` requires all 32 slots + 16 R32 picks for R32 completion.

## Architecture Decisions

| Decision | Options | Choice & Rationale |
|----------|---------|-------------------|
| **Slot ID scheme** | `{matchupId}-{side}` vs `{matchupId}_{side}` vs numeric | `{matchupId}-{side}` — mirrors `wcPicks` key format, easy to derive from matchup context. No collision with existing keys (`R16-M1`, `F-M1`). |
| **Slot team shape** | Full team object vs just name | Full `{ name, logo, group }` — avoids re-looking up standings on render. Bracket cells and engine need logo and name; group is needed for locked-mode info display. |
| **Side toggle behavior** | Toggle changes which side's click = assign+winner vs separate assign/pick clicks | Single active-side toggle. Active = click assigns team AND declares winner. Inactive = click assigns team only. Fewer clicks than separate assign/pick, clear UX: "who wins? pick from this side." |
| **Third-place pool cycling** | One group at a time vs paginate 4 groups per page | One group at a time. Arrow changes current candidate group, showing its 4 teams. Simpler state (single index), cleaner group indicator, matches FIFA's per-group third-place identity. |
| **Pool source** | From `wcStandings` groups directly vs cached `standings` prop | From `wcStandings` (Zustand). Already in store, always fresh. The modal is rendered in the bracket component which already uses standings. |
| **Engine slot check** | `wcSlots` first vs merge into standings before resolve | Check `wcSlots[id + '-{side}']` per-slot in the R32 config loop. Keeps engine pure, no mutation of standings. Null check falls through to `getTeamByRank`/`rankerResult`. |

## Data Flow

```
User clicks R32 matchup cell
  → setSelectedMatchup(m)        (Bracket state)
  → MatchupModal renders
    → SlotPoolSelector (home):
        - Reads standings from wcStandings
        - Fixed: reads group X's 4 teams → renders TeamCard × 4
        - Third: reads candidate group Y's 4 teams → renders + group indicator + arrows
    → SlotPoolSelector (away):
        - Same structure, different group/cycle source
    → User clicks active-side team
        → setWcSlot(slotId, team)      (store)
        → setWcPick(m.id, side)        (store, clears downstream picks)
    → User clicks inactive-side team
        → setWcSlot(slotId, team)      (store only)
    → User toggles active side
        → re-renders team cards with new active highlight
  → Bracket re-renders:
    → resolveBracket(wcPicks, graph, standings, rankerResult, wcSlots)
    → computeRoundStates(wcPicks, wcSlots, graph)
    → Grid cells reflect updated teams + picks
```

## File Changes

### `src/store/useAppStore.js` — Modify

Add state, actions, and partialize entry:

```js
// State (initial)
wcSlots: {},   // { [slotId]: { name, logo, group } | null }

// Actions
setWcSlot: (slotId, team) => set((state) => {
  const newSlots = { ...state.wcSlots, [slotId]: team };
  // Clear downstream picks when slot changes
  const newPicks = { ...state.wcPicks };
  // Walk DAG: find which matchup this slot belongs to, clear from there
  const matchupId = slotId.replace(/-(home|away)$/, '');
  let current = matchupId;
  while (TOURNAMENT_GRAPH[current]?.feedsInto) {
    const next = TOURNAMENT_GRAPH[current].feedsInto;
    delete newPicks[next];
    current = next;
  }
  return { wcSlots: newSlots, wcPicks: newPicks };
}),
clearAllWcSlots: () => set({ wcSlots: {} }),

// Updated partialize adds wcSlots
partialize: (state) => ({
  selectedLeagues: state.selectedLeagues,
  sortMode: state.sortMode,
  autoPollingEnabled: state.autoPollingEnabled,
  wcPicks: state.wcPicks,
  wcSlots: state.wcSlots,
  bracketMode: state.bracketMode,
}),
```

### `src/pages/WorldCupPage/Bracket/Bracket.jsx` — Major changes

- **`computeRoundStates`**: Add 3rd param `wcSlots`. For R32, require `all32SlotsFilled(wcSlots) && allR32Picked(wcPicks)`.
- **New `SlotPoolSelector` inline component** (or extracted file):
  - Props: `side`, `matchupId`, `standings`, `wcSlots`, `isActive`, `onToggle`, `onPick`
  - Fixed pool: reads `R32_CONFIG` for group → shows that group's 4 teams
  - Third-place pool: internal `currentGroupIndex` state, left/right arrow buttons, group indicator
  - Each pool shows up to 4 team cards (logo + name, compact `h-8`). Active side has blue highlight on selected team. Inactive side gray.
  - Selected team (in `wcSlots`) has checkmark or ring.
- **`renderModal` → `renderR32Modal`**: wraps two `SlotPoolSelector` + toggle radios + VS section
- **`renderR16PlusModal`**: simpler 2-team card picker (same as current modal logic, reused for R16+)
- **`renderLockedModal`**: read-only team display with date, group source
- **`renderModal`**: dispatches to one of the three based on `roundIndex` and `bracketMode`
- **Cell rendering**: R32 cells show team from `wcSlots` (or "Elegir Equipo" placeholder), winner blue dot
- **Controls**: "Resetear picks" clears both `wcSlots` and `wcPicks`

### `src/pages/WorldCupPage/Bracket/bracketEngine.js` — Modify

Add 5th `wcSlots` param. In the R32 config loop:

```js
export function resolveBracket(picks, graph, standings, rankerResult, wcSlots) {
  for (const cfg of R32_CONFIG) {
    const home = wcSlots?.[cfg.id + '-home'] || getTeamByRank(standings, cfg.homeRank, cfg.homeGroup);
    let away = null;

    if (wcSlots?.[cfg.id + '-away']) {
      away = wcSlots[cfg.id + '-away'];
    } else if (cfg.type === 'fixed') {
      away = getTeamByRank(standings, cfg.awayRank, cfg.awayGroup);
    } else if (rankerResult?.thirdPlaceSlots) {
      // existing logic: find slot in rankerResult.thirdPlaceSlots
    }

    // winner, isPending same as before
    matchups[cfg.id] = { home, away, winner: picks[cfg.id] || null, ... };
  }
  // R16+ resolution unchanged
}
```

### Test files

| File | Change |
|------|--------|
| `bracketRoundState.test.js` | Update `computeRoundStates` calls with `wcSlots` arg. Add test: 32 slots + 16 picks → R32 completed. Add test: 32 slots + 15 picks → R32 active. |
| `bracketEngine.test.js` | Add test: `wcSlots` overrides standings. Add test: empty `wcSlots` falls through. Add test: partial `wcSlots` mixed with standings. |
| `Bracket.integration.test.jsx` | Add `wcSlots` + `setWcSlot` + `clearAllWcSlots` to mock store. Test: R32 modal shows pool teams. Test: clicking team assigns slot + pick. Test: third-place arrows cycle groups. Test: locked mode read-only. |

## Testing Strategy

| Layer | Tests | Approach |
|-------|-------|----------|
| Unit (bracketEngine) | `wcSlots` override, fallback, mixed partial | Pure function, no DOM. Add 4 new `it` blocks. |
| Unit (roundState) | 32-slot + pick completeness, partial scenarios | Pure function. Add 3 new `it` blocks with 32‑slot mock. |
| Integration (Bracket) | R32 modal pool display, slot assignment, arrow cycling, R16+/locked modals, progressive unlock | Vitest + RTL. 6–8 new `it` blocks. Mock store with controllable `wcSlots`. |
## Migration / Rollback

No migration required. Existing `wcPicks` data survives. If users already have R32 picks without slots, `computeRoundStates` treats R32 as active (slots not filled). Rollback: revert files 1–3. Cleared `wcSlots` keys are ignored by older code.

## Open Questions

None.
