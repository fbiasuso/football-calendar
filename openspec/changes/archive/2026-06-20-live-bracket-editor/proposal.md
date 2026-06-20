# Propuesta: live-bracket-editor

## Intención

Transformar la sección "Llaves" del Mundial 2026 de una simulación manual a un bracket vivo con predicciones interactivas (pick'em) y tabla de terceros en "Grupos".

## Problema

Hoy el bracket requiere click en "Simular", no se actualiza solo, y no permite al usuario elegir ganadores ni seguir sus predicciones. La data de terceros existe en el ranker pero no se muestra en la UI.

## Scope

### In Scope

1. **Tabla de terceros ubicada** — ranking completo de los 12 equipos en 3.ª posición (Pts, GD, GF, Avanza? ✓/✗) debajo del grid de grupos en la pestaña "Grupos".
2. **Bracket en tiempo real** — el cálculo de terceros corre automáticamente vía `useMemo` desde las posiciones actuales. `wcBracket` en store pasa a ser capa de override para picks del usuario.
3. **Editor pick'em interactivo** — click en cualquier celda de R32 abre un modal con dos equipos. El usuario elige un ganador. La selección se propaga por el DAG del torneo (R32 → R16 → QF → SF → Final).

### Out of Scope

- Simulación automatizada más allá de R32 (sin machine learning ni predicciones)
- Scores, fechas ni datos de partido dentro del editor
- Deshacer/rehacer de picks
- Edición de grupos, composición de llaves o seedings

## Capacidades

### Nuevas
- `wc-thirdplace-table`: Tabla con 12 terceros rankeados + columna "Avanza?" (✓ con nombre del slot o ✗). Fuente de datos: `thirdPlaceRanker(standings).rankings` y `.thirdPlaceSlots`.
- `bracket-engine`: Grafo DAG del torneo (8 pares R32 → 8 R16 → 4 QF → 2 SF → 1 Final) + motor de propagación de picks. `bracketGraph.js` define las aristas; `bracketEngine.js` resuelve winners por el DAG.

### Modificadas
- `wc-bracket`: De simulación con botón a auto-cálculo en tiempo real + editor interactivo. Se agrega `wcPicks: { [matchupId]: 'home' | 'away' }` al store (persistido). El modal de detalle existente se expande con selección de ganador.

## Enfoque

| Feature | Approach |
|---------|----------|
| Tabla terceros | `ThirdPlaceTable.jsx` se renderiza en `GroupStandings.jsx` debajo del grid. Recibe `standings`, computa ranking + slots vía `thirdPlaceRanker`. Sin fetch extra. |
| Bracket real-time | `Bracket.jsx` usa `useMemo([standings])` → `thirdPlaceRanker(standings)`. Si hay `wcPicks`, se superponen al resultado computado. `wcBracket` mutable se escribe solo cuando el usuario hace un pick. |
| Editor pick'em | `bracketGraph.js` exporta `R32_PAIRS`, `FEEDS_INTO`. `bracketEngine.js` exporta `resolveBracket(picks)` → `{ winners, matchups }`. Modal se refactoriza para mostrar dos team cards clickeables. Picks se guardan en Zustand con persistencia. |

## Archivos Afectados

| Archivo | Impacto | Descripción |
|---------|---------|-------------|
| `src/store/useAppStore.js` | Modificado | Agregar `wcPicks` (persistido), refinar `wcBracket` como override |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | Modificado | Renderizar `ThirdPlaceTable` debajo del grid |
| `src/pages/WorldCupPage/GroupStandings/GroupStandings.jsx` | **Nuevo** | `ThirdPlaceTable.jsx` — tabla de 12 terceros |
| `src/pages/WorldCupPage/Bracket/Bracket.jsx` | Modificado | Auto-cálculo vía useMemo, modal pick'em, integración con bracketEngine |
| `src/pages/WorldCupPage/Bracket/bracketGraph.js` | **Nuevo** | DAG del torneo: pares R32, mapeo ronda→ronda |
| `src/pages/WorldCupPage/Bracket/bracketEngine.js` | **Nuevo** | Propagación de winners a través del DAG |
| `src/pages/WorldCupPage/Bracket/thirdPlaceRanker.js` | Sin cambios | Se reusa tal cual |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| DAG incorrecto (orden/mapeo de cruces) | Media | Tests unitarios por ronda; cotejar con fixture oficial FIFA |
| Rendimiento: 32 celdas reactivas + propagación | Baja | `useMemo` por ronda; propagación O(n) con n < 32; memo en componentes hoja |
| UX móvil: modal de selección en pantalla chica | Baja | Modal responsive: equipos apilados verticalmente en < 640px |

## Plan de Rollback

Revertir `useAppStore.js` (wcPicks). Revertir `GroupStandings.jsx`. Revertir `Bracket.jsx`. Eliminar `bracketGraph.js`, `bracketEngine.js`, `ThirdPlaceTable.jsx`. Sin migración de datos — wcPicks no existía previamente.

## Dependencias

- API-Football: ninguna nueva. Todo usa datos existentes (standings).
- `thirdPlaceRanker.js`: sin cambios. Se reusa tal cual.

## Criterios de Éxito

- [ ] Tabla de 12 terceros visible en "Grupos" con indicator "Avanza?" correcto
- [ ] Bracket en "Llaves" se actualiza automáticamente al cargar posiciones (sin botón)
- [ ] Click en celda R32 → modal con dos equipos → click en equipo → se marca como ganador
- [ ] Pick se propaga: R32 → R16 → QF → SF → Final
- [ ] Cambiar un pick en R32 limpia picks aguas abajo
- [ ] Picks persisten al recargar la página
- [ ] Sin picks del usuario, el bracket muestra el resultado computado de terceros
