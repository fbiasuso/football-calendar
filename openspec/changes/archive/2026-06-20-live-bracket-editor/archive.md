# Archive Report: live-bracket-editor

**Archived**: 2026-06-20  
**Status**: ✅ Complete (intentional, with warnings)

---

## 1. Change Description

Transformar la sección "Llaves" del Mundial 2026 de una simulación manual a un bracket vivo con predicciones interactivas (pick'em) y tabla de terceros en "Grupos".

Tres funcionalidades principales:
1. **Tabla de terceros ubicada** — ranking completo de los 12 equipos en 3.ª posición con columna "Avanza?" debajo del grid de grupos.
2. **Bracket en tiempo real** — auto-cálculo vía `useMemo` desde posiciones (sin botón "Simular").
3. **Editor pick'em interactivo** — click en celdas R32 → modal con dos team cards → selección de ganador se propaga por el DAG del torneo. Picks persisten entre recargas.

---

## 2. Files Created / Modified

| File | Action | Lines |
|------|--------|-------|
| `src/pages/WorldCupPage/Bracket/bracketGraph.js` | **Created** | 126 |
| `src/pages/WorldCupPage/Bracket/bracketEngine.js` | **Created** | 165 |
| `src/pages/WorldCupPage/GroupStandings/ThirdPlaceTable.jsx` | **Created** | 119 |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | **Modified** | 489 (refactored) |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | **Modified** | 58 (+import +render ThirdPlaceTable) |
| `src/store/useAppStore.js` | **Modified** | 121 (+wcPicks state, setWcPick, clearWcPicks, partialize) |
| `src/pages/WorldCupPage/WorldCupPage.jsx` | **Modified** | 43 (+rankerResult useMemo, pass to children) |
| `src/pages/WorldCupPage/Bracket/bracketGraph.test.js` | **Created** | Tests: graph structure, acyclic, 31 nodes |
| `src/pages/WorldCupPage/Bracket/bracketEngine.test.js` | **Created** | Tests: propagation, picks, downstream cleanup |
| `src/pages/WorldCupPage/GroupStandings/ThirdPlaceTable.test.jsx` | **Created** | Tests: 12 rows, ✓/✗, empty/null |
| `src/pages/WorldCupPage/Bracket/Bracket.integration.test.jsx` | **Created** | Tests: modal interaction, pick controls |

---

## 3. Tasks Completed

All **11/11** tasks marked complete in `tasks.md`:

| Phase | Task | Status |
|-------|------|--------|
| Phase 1: Foundation | 1.1 — bracketGraph.js (DAG, 31 nodes, R32_PAIRS) | ✅ |
| Phase 1: Foundation | 1.2 — bracketEngine.js (resolveBracket pure function) | ✅ |
| Phase 1: Foundation | 1.3 — useAppStore.js (wcPicks, setWcPick, clearWcPicks, persist) | ✅ |
| Phase 2: ThirdPlaceTable | 2.1 — ThirdPlaceTable.jsx (12 rows, ranking, Avanza?) | ✅ |
| Phase 2: ThirdPlaceTable | 2.2 — GroupStandings.jsx (render ThirdPlaceTable below grid) | ✅ |
| Phase 3: Bracket | 3.1 — WorldCupPage.jsx (rankerResult useMemo, pass as prop) | ✅ |
| Phase 3: Bracket | 3.2 — Bracket.jsx (auto-compute, "Resetear picks" button) | ✅ |
| Phase 3: Bracket | 3.3 — Bracket.jsx (pick'em modal, propagation, read-only R16+) | ✅ |
| Phase 4: Tests | 4.1 — bracketGraph + bracketEngine unit tests | ✅ |
| Phase 4: Tests | 4.2 — ThirdPlaceTable unit tests | ✅ |
| Phase 4: Tests | 4.3 — Bracket integration tests | ✅ |

---

## 4. Spec Verification Result

**PASS** — All spec requirements verified per verification phase.

| Domain | Requirements | Status |
|--------|-------------|--------|
| A. ThirdPlaceTable | A1–A5 (integration, columns, ordering, empty state) | ✅ Pass |
| B. Auto bracket | B1–B4 (useMemo auto-compute, override layer, reset button, auto-populate) | ✅ Pass |
| C. Pick'em editor | C1–C9 (DAG graph, engine, modal, indicators, pending state, store, persist, propagation, fallback) | ✅ Pass |
| Scenarios | E1–E11 (all 11 scenarios verified) | ✅ Pass |

---

## 5. Warnings

### ⚠️ Warning 1: `rankerResult` double-compute

`rankerResult` is computed via `useMemo` in `WorldCupPage.jsx` (line 15–18) and passed as a prop to both `GroupStandings` and `Bracket`. However, `GroupStandings` ignores this prop and only passes `standings` to `ThirdPlaceTable`, which computes its **own** `rankerResult` via a second `useMemo` (ThirdPlaceTable.jsx, line 6–9).

**Impact**: `thirdPlaceRanker(standings)` runs twice on every standings change — once in WorldCupPage (computes to `rankerResult`, unused by GroupStandings) and once in ThirdPlaceTable (computes to a local variable).

**Fix**: Pass `rankerResult` as a prop to `GroupStandings`, then to `ThirdPlaceTable` as an optional prop. In ThirdPlaceTable: if `rankerResult` is provided as prop, skip the local `useMemo` computation.

### ⚠️ Warning 2: Dead `wcBracket` store field

`wcBracket` remains defined in `useAppStore.js` (line 28) with its setter `setWcBracket` (line 71), but `Bracket.jsx` no longer reads from `wcBracket`. The bracket is now computed entirely via:

```js
const bracketData = useMemo(() => {
  if (!hasStandings) return null;
  return resolveBracket(wcPicks, TOURNAMENT_GRAPH, standings, rankerResult || null);
}, [hasStandings, wcPicks, standings, rankerResult]);
```

**Impact**: 1 dead state field + 1 dead action in the store. No observable bugs, but stale code that could cause confusion.

**Fix**: Remove `wcBracket` and `setWcBracket` from `useAppStore.js`. No migration needed — no code reads from `wcBracket` anymore.

---

## 6. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **DAG for pick propagation** | O(n) with n < 32, explicit acyclic graph, easy to validate |
| **Zustand persist for wcPicks** | Reuses existing persist middleware via `partialize`; no extra localStorage management |
| **Auto-cleanup downstream** | `setWcPick` walks DAG forward and deletes descendant picks — prevents inconsistent bracket states |
| **Read-only modal for R16+** | R16+ winners are deterministic (propagated from R32 picks); no user edit needed |
| **rankerResult computed once in WorldCupPage** | Avoids duplicate ranker computation across GroupStandings and Bracket (partially achieved — see Warning 1) |

---

## 7. Follow-up Items

| Priority | Item | Details |
|----------|------|---------|
| 🔴 Medium | Fix `rankerResult` double-compute | Pass `rankerResult` through GroupStandings → ThirdPlaceTable to avoid redundant computation |
| 🔴 Medium | Remove dead `wcBracket` code | Delete `wcBracket` state + `setWcBracket` action from useAppStore.js |
| 🟡 Low | Consider stale pick indicator | Per design open question: show visual warning when picked team no longer occupies the same bracket position after standings change |
| 🟡 Low | Post-tournament pick cleanup | After World Cup ends, `wcPicks` may contain stale matchup IDs — consider reset on tournament completion |

---

## 8. Archive Contents

| Artifact | Status |
|----------|--------|
| `proposal.md` | ✅ |
| `spec.md` | ✅ |
| `design.md` | ✅ |
| `tasks.md` | ✅ (11/11 tasks complete) |
| `archive.md` | ✅ (this file) |

No delta specs found (`specs/` subdirectory does not exist). No main specs directory (`openspec/specs/`) exists — no spec merge needed.

---

## 9. SDD Cycle Summary

```
Proposal → Spec → Design → Tasks → Apply → Verify → Archive ✅
```

The change has been fully planned (proposal, spec, design), broken into 11 tasks across 4 phases, implemented with new modules + modifications to 4 existing files, verified against all spec requirements and 11 scenarios, and archived with 2 non-critical warnings documented.
