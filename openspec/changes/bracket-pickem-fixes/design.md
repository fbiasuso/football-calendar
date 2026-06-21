# Design: Bracket Pick'em Fixes

## Technical Approach

Two independent fixes to `Bracket.jsx`:
1. **Locked mode filter**: intercept `wcPicks`/`wcSlots` before passing to `resolveBracket` — empty picks + null slots when locked, preventing editing session data from leaking.
2. **R32 modal 2-step flow**: replace active/inactive toggle with a local state machine (`'teams' | 'winner'`) inside `R32Modal`. Team selection (step 1) saves slots; winner selection (step 2) saves picks and closes modal.

No engine, store, or DAG changes needed — purely component-level.

## Architecture Decisions

| Decision | Choice | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Where to filter picks | Call site (`Bracket.jsx`: `useMemo`) | Inside `resolveBracket` | O-S: engine stays pure; filtering is a UI concern |
| Modal state management | Local `useState` in `R32Modal` | Global store | O-S: modal is ephemeral UI state, not data |
| Slot persistence timing | On team click (step 1) | On modal close | O-S: user can close modal without losing slot assignment |
| `SlotPoolSelector` changes | Add props (`expanded`, `onChangeTeam`, `step`) + remove `isActive`/`onToggle` | Replace component entirely | O-S: core layout stays; only interaction model changes |

## Data Flow

```
R32 cell click → setSelectedMatchup(m) → R32Modal renders
  │
  ├─ Step 1 ('teams')
  │    User clicks team card → setWcSlot(slotId, team)
  │      → expandedSide = team, other cards hide
  │      → "Cambiar equipo" appears
  │      → Third-place: arrows hide after selection
  │    If both sides have a team → step → 'winner'
  │
  └─ Step 2 ('winner')
       "Elegí el ganador del cruce" shown
       User clicks expanded team → setWcPick(id, side)
         → setSelectedMatchup(null) [modal closes]

Locked mode:
  effectivePicks = {}  (not wcPicks)
  effectiveSlots = null  (not wcSlots)
  → resolveBracket uses standings only → pure bracket view
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | Modify | Fix 1: add `effectivePicks`/`effectiveSlots` filter in `useMemo`. Fix 2: refactor `R32Modal` + `SlotPoolSelector` for 2-step flow |
| `src/pages/WorldCupPage/Bracket/Bracket.integration.test.jsx` | Modify | Update R32 modal tests for 2-step flow; add tests for step transitions, expand/collapse, winner pick |

## Interfaces / Contracts

### SlotPoolSelector new props

```
expanded: boolean          // true when this side has a selected team
onChangeTeam: () => void   // "Cambiar equipo" click
step: 'teams' | 'winner'   // controls behavior
```

Removed: `isActive`, `onToggle`

### R32Modal local state

```js
const [step, setStep] = useState('teams');  // 'teams' | 'winner'
const [expandedHome, setExpandedHome] = useState(slotTeam || null);
const [expandedAway, setExpandedAway] = useState(slotTeam || null);
```

`slotTeam` initializes from existing `wcSlots[id-home]` / `wcSlots[id-away]` on mount. If both have values, `step` starts as `'winner'`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Locked mode filter | Mock store with picks set → locked mode → assert `{}`/`null` passed to engine |
| Integration | Fix 1: locked mode display | Set picks + locked mode → verify standings teams shown, not picks |
| Integration | Step 1: team expand/collapse | Click team → assert expanded view + "Cambiar equipo" + other cards hidden |
| Integration | Step 1: third-place arrows | Select team → assert arrow buttons hidden |
| Integration | Step 2: auto-activate | Select both teams → assert "Elegí el ganador" appears |
| Integration | Step 2: winner pick | Click expanded team → assert `setWcPick` called + modal closes |
| Integration | Re-open with existing picks | Mock slots → open modal → assert both sides expanded + step='winner' |
| Integration | Locked mode modal unaffected | locked mode + R32 click → assert read-only modal (no change) |

## Migration / Rollout

No migration required. Slot structure in store (`wcSlots`, `wcPicks`) unchanged. Existing persisted data works with new modal.

## Open Questions

- None
