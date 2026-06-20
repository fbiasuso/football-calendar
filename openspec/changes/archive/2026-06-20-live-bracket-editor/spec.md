# Especificación: Editor interactivo de llaves (live-bracket-editor)

## Resumen

Tres funcionalidades que transforman la sección "Llaves" del Mundial 2026 de una simulación manual a un bracket vivo con predicciones interactivas, más una tabla de terceros en la pestaña "Grupos".

1. **Tabla de terceros ubicada**: ranking completo de los 12 equipos en 3.ª posición con columna "Avanza?" debajo del grid de grupos.
2. **Bracket en tiempo real**: el cálculo de terceros corre automáticamente desde las posiciones, sin botón "Simular".
3. **Editor pick'em interactivo**: click en cualquier celda del bracket abre un modal para elegir ganador. Los picks se propagan por el DAG del torneo y persisten entre recargas.

---

## Requerimientos

### A. Tabla de terceros (ThirdPlaceTable)

**A1 — Integración en pestaña Grupos**
El sistema DEBE renderizar `<ThirdPlaceTable>` debajo del grid 4×3 de grupos en `GroupStandings.jsx`, usando la misma prop `standings`.

**A2 — Cómputo de datos**
ThirdPlaceTable DEBE recibir `standings`, invocar `thirdPlaceRanker(standings)` y extraer `.rankings` (los 12 equipos rankeados) y `.thirdPlaceSlots` (los 8 slots con equipo asignado).

**A3 — Columnas de la tabla**
La tabla DEBE mostrar: # (posición ranking), Escudo+Equipo, Grupo, Pts, PJ, G, E, P, GF, GC, DG, y una columna "Avanza?" que muestre un indicador visual:

- ✓ (check verde) con el nombre del slot (ej. "M79") para los 8 equipos que avanzan.
- ✗ (cruz roja) para los 4 equipos que no avanzan.

**A4 — Orden de equipos**
Los 12 equipos DEBEN aparecer ordenados por ranking (Pts DESC > GD DESC > GF DESC), que es el orden que devuelve `thirdPlaceRanker().rankings`.

**A5 — Estados vacío**
Si no hay datos de posiciones, ThirdPlaceTable NO DEBE renderizarse ni romper el layout.

---

### B. Cómputo automático del bracket

**B1 — Auto-cálculo vía useMemo**
`Bracket.jsx` DEBE reemplazar el flujo imperativo `handleSimulate` + `setWcBracket()` por un `useMemo` que compute `thirdPlaceRanker(standings)` directamente desde las posiciones:

```js
const rankerResult = useMemo(
  () => (hasStandings ? thirdPlaceRanker(standings) : null),
  [standings]
);
```

**B2 — wcBracket como capa de override**
La variable `wcBracket` en Zustand DEJA de ser el resultado de la simulación y PASA a ser solo una capa de override para picks del usuario. El cómputo base siempre viene del `useMemo`.

**B3 — Botón "Simular" → "Resetear picks"**
El botón "Simular cruces" DEBE reemplazarse por un botón "Resetear picks" que invoque `clearWcPicks()`. Este botón DEBE estar deshabilitado si no hay picks activos.

**B4 — Auto-poblado de terceros**
Los terceros lugares DEBEN aparecer automáticamente en las celdas R32 correspondientes al cargar la pestaña "Llaves", sin necesidad de interacción del usuario.

---

### C. Editor pick'em interactivo

**C1 — Grafo del torneo (bracketGraph.js)**
`bracketGraph.js` DEBE exportar la estructura DAG con 31 nodos (16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final). Cada nodo DEBE especificar su ronda, a qué nodo alimenta y en qué lado (home/away). Los 8 pares de R32 DEBEN seguir el orden visual del bracket (top→bottom):

```
M74+M77, M73+M75, M83+M84, M81+M82, M76+M78, M79+M80, M86+M88, M85+M87
```

Cada par (`M74+M77`) alimenta la misma celda de R16, donde `M74` es home y `M77` es away.

**C2 — Motor de resolución (bracketEngine.js)**
`bracketEngine.js` DEBE exportar una función pura `resolveBracket(picks, graph, standings)` que:

- Use los picks del usuario (`{ [matchupId]: 'home' | 'away' }`) cuando existan.
- Use el resultado computado de `thirdPlaceRanker` para los slots de terceros.
- Recorra el DAG topológicamente.
- Devuelva el bracket completo resuelto con equipos, ganadores y estado "Pendiente" para celdas no determinadas.

**C3 — Modal de selección**
Al hacer click en una celda del bracket, el sistema DEBE abrir un modal que muestre:

- Para R32: los dos equipos (home y away) reales de ese cruce. El usuario hace click en uno para seleccionarlo como ganador.
- Para R16 en adelante: los dos equipos que podrían avanzar desde las rondas anteriores. Si uno o ambos no están determinados, muestra "Pendiente" en ese lado.

**C4 — Indicador visual de pick**
Cuando el usuario ha seleccionado un ganador en una celda, el equipo elegido DEBE mostrar un indicador visual sutil (checkmark o punto azul). La celda del bracket DEBE reflejar el equipo ganador propagado.

**C5 — Estado "Pendiente"**
Las celdas de rondas avanzadas (R16+) cuyo ganador aún no esté determinado DEBEN mostrar "Pendiente" en lugar de un equipo.

**C6 — Almacenamiento de picks (store)**
El store Zustand DEBE agregar:

- `wcPicks: {}` — objeto `{ [matchupId]: 'home' | 'away' }`, persistido vía `partialize`.
- `setWcPick(matchupId, side)` — registra el pick y ELIMINA picks aguas abajo (descendientes en el DAG).
- `clearWcPicks()` — resetea todos los picks.

**C7 — Persistencia**
Los picks (`wcPicks`) DEBEN sobrevivir a la recarga de la página.

**C8 — Propagación por el DAG**
Al seleccionar un ganador en R32, el sistema DEBE propagar ese equipo como participante en la celda de R16 correspondiente, y así sucesivamente hasta la Final.

**C9 — Sin picks → bracket computado**
Si el usuario no ha hecho ningún pick, el bracket DEBE mostrar el estado completamente computado desde `thirdPlaceRanker`.

---

## Escenarios

### Escenario 1: Tabla de terceros visible en Grupos
- DADO que el usuario está en la pestaña "Partidos"
- CUANDO hace click en "Mundial 2026"
- Y la pestaña "Grupos" está activa
- ENTONCES se muestra el grid 4×3 de grupos
- Y debajo del grid se renderiza ThirdPlaceTable con los 12 equipos rankeados

### Escenario 2: Columnas correctas en ThirdPlaceTable
- DADO que existen datos de posiciones para los 12 grupos
- CUANDO ThirdPlaceTable se renderiza
- ENTONCES cada fila muestra: #, escudo+equipo, grupo, Pts, PJ, G, E, P, GF, GC, DG, Avanza?
- Y los 8 equipos que avanzan tienen ✓ con el nombre del slot
- Y los 4 equipos eliminados tienen ✗

### Escenario 3: Bracket se auto-puebla al abrir Llaves
- DADO que el usuario está en la pestaña "Grupos" con posiciones cargadas
- CUANDO hace click en "Llaves"
- ENTONCES el bracket se renderiza inmediatamente
- Y los 8 slots de terceros muestran el equipo asignado por `thirdPlaceRanker`
- Y NO hay botón "Simular" visible

### Escenario 4: Click en R32 abre modal de selección
- DADO que el bracket está visible en Llaves
- CUANDO el usuario hace click en una celda de R32 (con equipos reales)
- ENTONCES se abre un modal con dos team cards (home y away) lado a lado
- Y debajo se muestra la información del cruce (ID, fecha, fuente)

### Escenario 5: Usuario selecciona un ganador
- DADO que el modal de selección está abierto para un cruce R32
- CUANDO el usuario hace click en uno de los dos equipos
- ENTONCES el modal se cierra
- Y el equipo seleccionado muestra un indicador visual (checkmark)
- Y el pick se guarda en `wcPicks`

### Escenario 6: Pick se propaga a rondas siguientes
- DADO que el usuario seleccionó un ganador en un cruce R32
- CUANDO se cierra el modal
- ENTONCES el equipo ganador aparece en la celda de R16 correspondiente
- Y si ambos feeds de R16 están resueltos, el modal de R16 permite seleccionar ganador

### Escenario 7: Cambiar pick limpia picks aguas abajo
- DADO que el usuario tiene picks en R32 y R16
- CUANDO cambia el pick en R32
- ENTONCES el pick de R16 se elimina automáticamente
- Y la celda de R16 vuelve a mostrar "Pendiente" o el equipo que aún es válido

### Escenario 8: Resetear todos los picks
- DADO que el usuario ha hecho varios picks
- CUANDO hace click en "Resetear picks"
- ENTONCES todos los picks se eliminan
- Y el bracket vuelve al estado completamente computado desde `thirdPlaceRanker`

### Escenario 9: Picks sobreviven a recarga
- DADO que el usuario ha hecho picks en varios cruces
- CUANDO recarga la página
- ENTONCES los picks se restauran desde localStorage
- Y el bracket muestra los equipos seleccionados y sus propagaciones

### Escenario 10: Sin datos de posiciones
- DADO que no hay datos de posiciones (pre-torneo)
- CUANDO el usuario ve la pestaña "Llaves"
- ENTONCES el bracket muestra el estado vacío "Sin datos de posiciones"
- Y los botones de acción están deshabilitados

### Escenario 11: R16+ con equipo pendiente
- DADO que solo un lado de un cruce R16 está resuelto
- CUANDO se renderiza la celda R16
- ENTONCES el lado resuelto muestra el equipo correspondiente
- Y el lado no resuelto muestra "Pendiente"
- Y la celda no es clickeable hasta que ambos lados estén resueltos
