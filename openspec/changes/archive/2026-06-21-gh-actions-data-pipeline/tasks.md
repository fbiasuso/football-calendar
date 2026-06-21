# Tasks: GH Actions Data Pipeline

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~574 (scripts) + ~200 (tests) = ~774 |
| 400-line budget risk | High |
| Chained PRs recommended | Sí |
| Suggested split | PR 1 (Foundation) → PR 2 (Pipeline) → PR 3 (Frontend) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Scripts base: api.js + storage.js | PR 1 | base = `feat/gh-actions-data-pipeline` |
| 2 | Pipeline: schedule.js + fetch-data.js + workflow | PR 2 | base = PR 1 branch |
| 3 | Frontend: adapter.js + useWorldCup.js | PR 3 | base = feature branch (independiente de PR 2 en código) |

---

## Fase 1: Fundación — Scripts base

- [x] 1.1 Crear `scripts/lib/api.js` — copiar `fetchWithRetry`, `mapStatus`, `isKnockoutRound`, `normalizeMatch`, `formatDate`, `formatUtcDate`, `normalizeStandings` desde `apiFootball.js` adaptado a Node.js (`process.env.VITE_API_FOOTBALL_API_KEY`, URL directa `https://v3.football.api-sports.io`). Exportar `getMatches(date)`, `getLiveMatches()`, `getStandings(leagueId, season)`, `getRounds(leagueId, season)`, `getMatchById(id)`. Sin `getCompetitions` ni `findFirstLegMatch` (no necesarios en scripts).
- [x] 1.2 Crear `scripts/lib/storage.js` — exportar `loadJSON(path)` (lectura archivo + parse JSON, retorna null si no existe), `saveJSON(path, data)` (serializa y escribe), `hasChanges(newData, existingData)` (deep equality vía `JSON.stringify`), `saveMatches(date, matches)`, `saveStandings(data)`, `saveSchedule(data)`, `saveMeta(data)`. Todos los paths relativos a `./data/`.
- [x] 1.3 Tests unitarios para `api.js`: `normalizeMatch`, `mapStatus`, `formatDate`, `formatUtcDate` con fixtures mock de API-Football.

## Fase 2: Pipeline — Schedule + Entry + GH Action

- [x] 2.1 Crear `scripts/schedule.js` — exportar función pura `getSchedule({ now, knownFixtures, mode, lastFetched, meta })`. Lógica: modo MUNDIAL (20-jun al 20-jul 2026, ventana 12PM–2AM ART, frec 2h, 30min si próximo partido <2h, 15min si live) y modo LIGAS (default, ventana 8AM–1AM ART, frec 30min, 15min si live, 4h si sin partidos). Off-hours (4–6AM): un fetch diario para `schedule` únicamente. Return `{ shouldFetch, reasons, nextPlanned, endpoints }`.
- [x] 2.2 Crear `scripts/fetch-data.js` — entry point: (1) leer modo desde env o detectar por fecha, (2) cargar `meta.json` con `storage.loadJSON`, (3) llamar `schedule.getSchedule()`, (4) si `!shouldFetch` → `process.exit(0)`, (5) `api.getMatches(today) + api.getMatches(tomorrow)`, (6) si modo=worldcup: `api.getStandings(1, 2026)`, (7) si hay live: `api.getLiveMatches()`, (8) `storage.save*` cada uno, (9) si ningún dato cambió → `exit(0)`, (10) en error → `exit(1)`.
- [x] 2.3 Crear `.github/workflows/fetch-football-data.yml` — cron `*/30 14-23,0-4 * * *` + `0 9 * * *` (UTC cubriendo ART), `workflow_dispatch`, checkout `ref: gh-pages`, `setup-node@v4`, `npm ci`, ejecutar `scripts/fetch-data.js` con `VITE_API_FOOTBALL_API_KEY` desde secrets, commit+push solo si `git status --porcelain` detecta cambios.
- [x] 2.4 Tests unitarios para `schedule.js`: casos paramétricos con mock de Date — todas las ventanas horarias, ambos modos, con/sin fixtures, con/sin live.
- [x] 2.5 Tests de integración para `fetch-data.js`: mock de api.js y storage.js, verificar flujo completo (shouldFetch=true → escribe archivos, shouldFetch=false → exit 0).

## Fase 3: Frontend — Consumo estático

- [x] 3.1 Modificar `src/api/adapter.js` — agregar `tryFetchStatic(key)` que intenta `fetch('/data/' + key)`, retorna datos o null. Agregar auto-detección al primer llamado (intenta `/data/meta.json`, cachea resultado en módulo). Modificar `getMatches(date)`: primero intenta `tryFetchStatic('matches-{dateKey}.json')`, si falla usa API real. Modificar `getStandings()`: primero intenta `tryFetchStatic('standings.json')`, si falla usa API real. Soportar env var `VITE_DATA_SOURCE=static|live` para override explícito. Misma firma de retorno.
- [x] 3.2 Modificar `src/hooks/useWorldCup.js` — reemplazar `import { getStandings, getRounds } from '../api/apiFootball.js'` por `import { getStandings, getRounds } from '../api/adapter.js'`. Eliminar dependencia directa de `apiFootball.js`.

## Resumen

| Fase | Tareas | Foco |
|------|--------|------|
| 1: Fundación | 3 | api.js + storage.js (scripts Node.js) |
| 2: Pipeline | 5 | schedule + fetch-data + workflow + tests |
| 3: Frontend | 2 | adapter static-mode + useWorldCup cleanup |
| **Total** | **10** | |

### Orden de implementación

PR 1 (Fase 1) → PR 2 (Fase 2) → PR 3 (Fase 3). Las fases 1 y 2 tienen dependencia secuencial (`fetch-data.js` importa `api.js` y `storage.js`). La fase 3 es independiente en código pero depende de que el pipeline esté activo para tener datos estáticos que consumir.

### Próximo paso

Definir estrategia de chained PRs. Como el estimado excede 400 líneas (High risk), se recomienda dividir en 3 PRs usando `feature-branch-chain`. Se necesita decisión del equipo antes de `sdd-apply`.
