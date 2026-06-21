# Proposal: bracket-pickem-complete

## Intent

Full slot-based bracket pick'em replacing home/away picks. Users assign 32 R32 slots from configurable pools, then pick winners through 5 rounds with progressive unlock.

## Scope

### In Scope
1. `wcSlots` — 32 persisted slot assignments via Zustand.
2. Pool system — fixed slots from group teams; third-place from `THIRD_PLACE_CANDIDATES` with arrow cycling.
3. Unified R32 modal — dual pools, active toggle, 4 team cards, group indicator.
4. R16+ modal — 2-team click-to-pick for all later rounds.
5. Locked mode modal — read-only info (teams, date, group source).
6. Engine: `resolveBracket` checks `wcSlots` first, falls back to standings.
7. Progressive unlock — round unlocks only when previous is fully filled.
8. Tab persistence — `wcSlots` survives navigation.

### Out of Scope
Auto-fill, multi-user, undo individual slots, slot assignment beyond R32.

## Capabilities

### Modified
- `wc-bracket`: From home/away picks to slot-based assignment with pools and progressive unlock.

### New
- `wc-slot-pools`: Pool generation and browsing for R32 slots.

## Approach

| Concern | Decision |
|---------|----------|
| State | `wcSlots: { [slotId]: { name, logo, group } \| null }`, persisted |
| Resolution | Locked = standings only; editing = `wcSlots` + `wcPicks` |
| Pools | From `standings` (4/group) + `THIRD_PLACE_CANDIDATES` |
| Unlocking | `computeRoundStates` extended: R32 needs 32 slots + 16 picks |
| Modal | Single `MatchupModal` for R32 pools and R16+ winner picks |
| Engine | `resolveBracket` gains `wcSlots` param; slot values override standings |

## Affected Areas

| Area | Impact |
|------|--------|
| `src/store/useAppStore.js` | Add `wcSlots` + actions; extend `partialize` |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | New R32 pool modal, R16+ modal, locked modal |
| `src/pages/WorldCupPage/Bracket/bracketEngine.js` | Accept `wcSlots`; check before standings |
| `src/pages/WorldCupPage/Bracket/Bracket.integration.test.jsx` | New scenarios |
| `src/pages/WorldCupPage/Bracket/bracketRoundState.test.js` | Extended for 32-slot requirement |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Pool cycling + group indicator = complex UI | Medium | Extract `SlotPoolSelector`, unit test |
| 32 slots + 16 picks before R16 unlocks | Medium | Show N/32 progress per matchup row |
| `computeRoundStates` change breaks tests | Medium | Full coverage on old + new scenarios |

## Rollback Plan

Revert `useAppStore.js`, `Bracket.jsx`, `bracketEngine.js`. No migration.

## Dependencies

None. All data from standings + `THIRD_PLACE_CANDIDATES`.

## Success Criteria

- [ ] All 32 R32 slots assignable from correct pools
- [ ] R16+ winner picks and locked read-only modal work
- [ ] Progressive unlock: R32 → R16 → QF → SF → Final
- [ ] `wcSlots` persists across tabs and reload
- [ ] Editing mode uses `wcSlots`; locked mode uses standings
- [ ] Champion banner updates from full resolution
