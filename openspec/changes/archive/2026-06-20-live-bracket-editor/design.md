# Design: Live Bracket Editor

## Technical Approach

Transformar el bracket del Mundial 2026 de simulación manual a un sistema vivo con tres capas: (1) tabla de terceros en "Grupos", (2) auto-cálculo del bracket vía `useMemo` desde standings, (3) editor pick'em con propagación de picks a través de un DAG. Se agregan dos módulos puros (`bracketGraph.js`, `bracketEngine.js`) y un componente (`ThirdPlaceTable.jsx`). Sin fetch extra a la API — todo usa los standings ya disponibles.

## Architecture Decisions

| Decisión | Opciones | Tradeoff | Elegido |
|----------|----------|----------|---------|
| Propagación de picks | DAG vs recalcular todo cada vez | DAG permite O(n) con n < 32; recalcular es frágil si cambia el torneo | **DAG explícito** |
| Persistencia de picks | `wcPicks` en Zustand persist vs localStorage manual | Persist middleware ya existe; integración directa | **Zustand persist** en `partialize` |
| Limpieza downstream | Manual (click botón) vs automática al cambiar pick | Automática evita brackets inconsistentes; costo mínimo | **Automática** en `setWcPick` |
| Edición R16+ | Modal read-only vs editable igual que R32 | R16+ se resuelve por propagación; no tiene sentido editar | **Modal read-only** para R16+ |
| Cómputo del ranker | Una vez en WorldCupPage vs duplicado en Bracket + GroupStandings | Computar una vez evita doble trabajo; pasar como prop | **Una vez en WorldCupPage**, se pasa a ambos hijos |

## Data Flow

```
API ──→ useWorldCup ──→ standings ──→ WorldCupPage
                                            │
                        ┌────────────────────┤
                        ▼                    ▼
              GroupStandings              Bracket
                        │                    │
                        ▼                    │
              thirdPlaceRanker               │
                        │                    │
                        ▼                    ▼
              ThirdPlaceTable        resolveBracket(standings, picks)
                                             │
                                     ┌───────┴───────┐
                                     ▼               ▼
                               bracketGraph    bracketEngine
                                     │               │
                                     ▼               ▼
                               TOURNAMENT_    resolveBracket()
                               GRAPH +        → matchups[]
                               R32_PAIRS
                                             │
                                     ┌───────┘
                                     ▼
                               useAppStore.wcPicks
                               (persist, { [matchupId]: 'home'|'away' })
```

### Flujo de propagación

```
setWcPick('M74', 'away')
  → setWcBracket(...) con el pick
  → clearDownstream('M74') — borra picks en R16-M1, QF-M1, SF-M1, F-M1
  → resolveBracket() recalcula:
      M74: home=1°E, away=3°[A/B/C/D/F], winner=away (pick)
      R16-M1: feeds M74(winner) + M77(winner) → winner=pending (sin pick)
      QF-M1: feeds R16-M1(winner) + R16-M2(winner) → winner=pending
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/pages/WorldCupPage/Bracket/bracketGraph.js` | Crear | DAG del torneo: 31 matchups con aristas `feedsInto` + `R32_PAIRS` |
| `src/pages/WorldCupPage/Bracket/bracketEngine.js` | Crear | `resolveBracket(picks, graph, standings)` — propagación pura |
| `src/pages/WorldCupPage/Bracket/ThirdPlaceTable.jsx` | Crear | Tabla de 12 terceros rankeados con columna "Avanza?" |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | Modificar | Auto-cálculo vía useMemo, modal pick'em, integración con engine |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | Modificar | Renderizar `<ThirdPlaceTable>` debajo del grid |
| `src/store/useAppStore.js` | Modificar | Agregar `wcPicks`, `setWcPick`, `clearWcPicks` con persistencia |
| `src/pages/WorldCupPage/WorldCupPage.jsx` | Modificar | Computar `rankerResult` una vez, pasarlo a Bracket y GroupStandings |
| `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.js` | Sin cambios | Reutilizado tal cual |
| `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.test.js` | Sin cambios | Tests existentes siguen siendo válidos |

## Interfaces / Contracts

### bracketGraph.js

```js
// 31 matchups: M73-M88 (R32), R16-M1..M8, QF-M1..M4, SF-M1..M2, F-M1
TOURNAMENT_GRAPH = {
  'M74':      { round: 'R32', feedsInto: 'R16-M1', as: 'home' },
  'M77':      { round: 'R32', feedsInto: 'R16-M1', as: 'away' },
  'R16-M1':   { round: 'R16', feedsInto: 'QF-M1',  as: 'home' },
  // ... 31 entries total
};
R32_PAIRS = [
  ['M74', 'M77'],  // → R16-M1
  ['M73', 'M75'],  // → R16-M2
  // ... 8 pairs
];
```

### bracketEngine.js

```js
resolveBracket(picks, graph, standings, rankerResult)
// → {
//     matchups: {
//       'M74':  { home: {...team}, away: {...team}, winner: 'home'|'away'|null, isPending: bool },
//       'R16-M1': { home: {...team}, away: {...team}, winner: null, isPending: true },
//       ...
//     }
//   }
```

Algoritmo:
1. Resolver R32 desde standings + rankerResult (terceros)
2. Aplicar `picks[matchupId]` si existe → winner
3. Para cada ronda subsiguiente: resolver `home`/`away` desde `feedsInto` del DAG + `picks` si existen
4. `isPending = !winner && (home && away)`
5. Return `matchups` completo

### Store (useAppStore.js)

```js
// Nuevo estado persistido
wcPicks: {},  // { [matchupId]: 'home'|'away' }

// Nuevas acciones
setWcPick: (matchupId, side) => set((state) => ({
  wcPicks: {
    ...state.wcPicks,
    [matchupId]: side,  // o null para deseleccionar
  },
})),

clearWcPicks: () => set({ wcPicks: {} }),

// partialize se extiende:
partialize: (state) => ({
  ...state.partialize,
  wcPicks: state.wcPicks,
}),
```

## Testing Strategy

| Capa | Qué probar | Cómo |
|------|-----------|------|
| Unit (bracketGraph) | Estructura del grafo: 31 nodos, aristas correctas, sin ciclos | Test que verifica `Object.keys(TOURNAMENT_GRAPH).length === 31` y que el DAG es acíclico (topological sort) |
| Unit (bracketEngine) | Propagación sin picks, con picks parciales, con picks completos, limpieza downstream | Mock de `thirdPlaceRanker`, `standings`, `graph`. Verificar winners esperados |
| Unit (ThirdPlaceTable) | Renderizado con 12 equipos, equipos avanzan/eliminados | Render con datos mock; verificar que top 8 tienen ✓ y bottom 4 ✗ |
| Integration (Bracket) | Modal pick'em se abre en R32, no en R16+ | Test de componente con `vitest` + `@testing-library/react` |
| Integration (GroupStandings) | ThirdPlaceTable aparece debajo del grid | Render con standings mock; verificar que el componente se renderiza |

## Edge Cases

1. **Standings vacíos**: `rankerResult` es `null`, `resolveBracket` retorna matchups vacíos. Bracket muestra "Sin datos de posiciones". Modal no abre porque no hay equipos.
2. **Standings parciales** (< 12 grupos): `thirdPlaceRanker` ya maneja este caso. Slots sin equipo asignado muestran "Pendiente".
3. **Pick inválido por cambio de standings**: Si un equipo que el usuario pickeó ya no está en esa posición, el pick queda en `wcPicks` pero el `resolveBracket` ignora equipos que no existen. El usuario ve el equipo original pero con indicador visual de stale.
4. **Propagación stale**: Al cambiar un pick en R32, `setWcPick` recorre el DAG hacia adelante y elimina picks downstream. La UI se actualiza instantáneamente porque `resolveBracket` depende de `wcPicks`.
5. **Picks sin terceros computados**: Si no hay standings, `rankerResult` es null y no se puede hacer pick en slots de terceros. Los matchups fixed (M73, M75, etc.) con ambos equipos conocidos sí son pickeables.
6. **Mobile modal**: Usar `flex-col` en `< 640px` para los team cards (ya existe patrón responsive en Tailwind del proyecto).

## Open Questions

- [ ] ¿Mostrar indicador visual cuando un pick es stale (equipo ya no está en esa posición)?
- [ ] ¿Propagar picks más allá de R32 o solo dejar que el engine resuelva automáticamente?
- [ ] ¿Tiempo de caché de `wcPicks` al cambiar de torneo (Mundial 2026 termina, los picks quedan huérfanos)?
