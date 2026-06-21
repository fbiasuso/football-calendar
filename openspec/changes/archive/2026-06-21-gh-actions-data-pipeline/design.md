# Design: GH Actions Data Pipeline

## Technical Approach

Migrar todo el consumo de API-Football del runtime del frontend a un GitHub Action con schedule, que ejecuta scripts Node.js puros, persiste los datos como JSONs estáticos en la rama `gh-pages`, y hace commit condicional solo cuando hay cambios reales. El frontend lee de `/data/*.json` con detección automática y fallback a API real en desarrollo. Los hooks `useMatches` y `useWorldCup` no cambian su interfaz — el adapter resuelve la fuente transparentemente.

## Architecture Decisions

| Decisión | Opciones | Tradeoff | Elegido |
|----------|----------|----------|---------|
| Fuente de datos frontend | Static-first con fallback vs env var toggle | Static-first funciona out-of-the-box en producción sin config; env var da control explícito al desarrollador | **Static-first con fallback** — auto-detecta vía `fetch(/data/meta.json)` |
| Persistencia de JSONs | gh-pages branch vs artifact de GH Action vs repo mismo | gh-pages es un static host nativo de GH, accesible vía `/data/*`; artifacts requieren descarga extra | **gh-pages branch** — servido directamente por GitHub Pages sin middleware |
| Commit condicional | Diff estricto vs commit siempre | Diff estricto evita bloat en git history y runs innecesarios de Pages deploy | **Diff estricto** — `JSON.stringify` + comparación antes de escribir |
| Schedule adaptativo | Cron fijo cada 30min vs lógica en script que decide | Script decide permite ahorrar quota cuando no hay partidos; cron fijo es más simple pero gasta runs al pedo | **Schedule adaptativo** — el script decide si debe fetch, el cron solo da la ventana máxima de oportunidad |
| Normalización de datos | Reutilizar `apiFootball.js` vs copiar lógica a `scripts/` | Copiar evita dependencias del entorno browser (import.meta.env, Vite proxy) y mantiene los scripts autónomos | **Copia dedicada** en `scripts/lib/api.js` — misma lógica, adaptada a Node.js + `process.env` |
| `storage.js` como única pieza migrable | Single storage module vs lógica dispersa | Concentrar toda la interacción con el filesystem en un módulo permite reemplazarlo por KV/Blob sin tocar el pipeline | **storage.js monolítico** — `save*()` y `loadJSON()` son la única interfaz con el sistema de archivos |

## Data Flow

```
                     GITHUB ACTION (cada 30 min)
                     ┌─────────────────────────────────────┐
                     │  .github/workflows/fetch-football-   │
                     │  data.yml                            │
                     │         │                            │
                     │         ▼                            │
                     │  scripts/fetch-data.js               │
                     │         │                            │
                     │    ┌────┴────┐                       │
                     │    ▼         ▼                       │
                     │  schedule.js  api.js                 │
                     │  (¿fetch?)    (↔ API-Football)       │
                     │    │         │                       │
                     │    │         ▼                       │
                     │    │    storage.js                   │
                     │    │    (compara + escribe)          │
                     │    │         │                       │
                     │    └─────────┤                       │
                     │              ▼                       │
                     │         git commit?                  │
                     │         (solo si cambió)             │
                     │              │                       │
                     └──────────────┼───────────────────────┘
                                    │ push a gh-pages
                                    ▼
                     ┌──────────────────────────────┐
                     │  gh-pages branch              │
                     │  data/                        │
                     │  ├── matches-YYYY-MM-DD.json  │
                     │  ├── standings.json           │
                     │  ├── schedule.json            │
                     │  ├── live.json                │
                     │  └── meta.json                │
                     └──────────┬───────────────────┘
                                │ servido como static
                                ▼
                     FRONTEND (runtime)
                     ┌──────────────────────────────┐
                     │  src/api/adapter.js           │
                     │  (static-first + fallback)    │
                     │         │                     │
                     │         ▼                     │
                     │  src/hooks/useMatches.js      │
                     │  src/hooks/useWorldCup.js     │
                     │  (sin cambios de interfaz)    │
                     │         │                     │
                     │         ▼                     │
                     │  Componentes React            │
                     │  (UI idéntica)                │
                     └──────────────────────────────┘
```

### Flujo detallado por ejecución

```
1. GH Action desencadena por cron (o workflow_dispatch)
2. Checkout de rama gh-pages (fetch-depth: 1)
3. node scripts/fetch-data.js
   a. storage.loadJSON('data/meta.json') → último estado conocido
   b. schedule.getSchedule({ now, knownFixtures, mode })
      → ¿shouldFetch? NO → exit(0) (0 commits, 0 quota API)
   c. api.getMatches(today) + api.getMatches(tomorrow)
   d. Si mode=worldcup: api.getStandings(1, 2026)
   e. Si hay live: api.getLiveMatches()
   f. storage.saveMatches(date, data) → compara con existente
   g. Solo escribe si hubo cambios → git add + commit + push
4. gh-pages se actualiza → GitHub Pages sirve nuevos JSONs
5. Próxima visita del usuario: adapter.js detecta JSONs disponibles
   → fetch('/data/matches-...') → datos estáticos
   → CERO llamadas a API-Football desde el navegador
```

## File Changes

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `scripts/fetch-data.js` | 🆕 Crear | Entry point: orquesta schedule → api → storage |
| `scripts/schedule.js` | 🆕 Crear | Lógica de schedule adaptativo (mundial/ligas) |
| `scripts/lib/api.js` | 🆕 Crear | Wrapper API-Football para Node.js (sin dependencias browser) |
| `scripts/lib/storage.js` | 🆕 Crear | Persistencia a JSON en gh-pages + diff. Única pieza migrable a serverless |
| `.github/workflows/fetch-football-data.yml` | 🆕 Crear | GH Action: cron + workflow_dispatch + commit condicional |
| `src/api/adapter.js` | ✏️ Modificar | Modo static-first con auto-detección y fallback a API real |
| `src/hooks/useWorldCup.js` | ✏️ Modificar | Usar adapter.getStandings() en lugar de import directo a apiFootball |

### Sin cambios

- `src/hooks/useMatches.js` — ya usa el adapter, no toca
- `src/store/useAppStore.js` — no necesita cambios
- Todos los componentes React — interfaz de datos idéntica

## Interfaces / Contracts

### scripts/lib/api.js — Funciones exportadas

```js
getMatches(date)           → Promise<Match[]>       // YYYY-MM-DD
getStandings(leagueId, season) → Promise<Group[]>   // [{ group, teams }]
getRounds(leagueId, season)    → Promise<string[]>
getLiveMatches()               → Promise<Match[]>
getFixtureById(id)             → Promise<Match>
```

**Diferencias con src/api/apiFootball.js**:
- Usa `process.env.VITE_API_FOOTBALL_API_KEY` (vs `import.meta.env`)
- Llama directo a `https://v3.football.api-sports.io` (vs proxy `/api/api-football`)
- `fetchWithRetry(endpoint)` construye URL completa, no usa proxy path
- `normalizeMatch(fixture)` y `mapStatus(shortCode)` — idénticas
- `formatDate(date)` y `formatUtcDate(date)` — idénticas

### scripts/schedule.js

```js
getSchedule({ now: Date, knownFixtures: Fixture[], mode: 'worldcup'|'leagues' })
→ {
    shouldFetch: boolean,
    reasons: string[],
    nextPlanned: Date,
    endpoints: string[]     // ['fixtures', 'standings', 'live']
  }
```

Algoritmo:

```
MODO MUNDIAL (20-jun a 20-jul 2026):
  hora = now.getHours() (ARG UTC-3)
  
  Si hora entre 2:00 y 11:59:
    → skip, excepto un fetch a las 6:00 para agenda del día
  Sino (12:00 - 2:00):
    Si no hay partidos programados hoy:
      → skip
    Si hay partido en vivo ahora:
      → fetch cada 15 min
    Si próximo partido en < 2h:
      → fetch cada 30 min
    Sino:
      → fetch cada 2h

MODO LIGAS (default):
  hora = now.getHours() (ARG UTC-3)
  
  Si hora entre 2:00 y 7:59:
    → skip, excepto un fetch a las 5:00 para agenda del día
  Sino (8:00 - 1:00):
    Si no hay fixtures conocidos:
      → fetch cada 4h (verificar si hay partidos nuevos)
    Si hay partido en vivo:
      → fetch cada 15 min
    Sino:
      → fetch cada 30 min
```

### scripts/lib/storage.js

```js
saveMatches(date: string, matches: Match[])  → boolean  // true si cambió
saveStandings(standings: Group[])             → boolean
saveSchedule(schedule: Schedule)              → boolean
saveMeta(meta: Meta)                          → boolean
loadJSON(path: string)                        → any | null
hasChanges(newData: any, existingData: any)   → boolean  // deep equality
```

**Formato meta.json:**
```json
{
  "lastFetched": "2026-06-20T14:30:00.000Z",
  "source": "api-football",
  "mode": "worldcup",
  "nextPlanned": "2026-06-20T16:30:00.000Z",
  "endpointsUsed": ["fixtures", "standings"],
  "fixturesToday": 4,
  "liveNow": 0
}
```

### adapter.js — Modo static

```js
// Auto-detección: al primer llamado, intenta fetch('/data/meta.json')
// Si existe → modo estático para toda la sesión
// Si no existe → fallback a API real (dev, o gh-pages no deployado)

async function getMatches(date) {
  const key = `matches-${getDateKey(date)}.json`;
  const static = await tryFetchStatic(key);
  if (static) return static;
  return apiFootball.getMatches(date);
}

async function getStandings(leagueId, season) {
  const static = await tryFetchStatic('standings.json');
  if (static) return static;
  return apiFootball.getStandings(leagueId, season);
}
```

## Testing Strategy

| Capa | Qué probar | Enfoque |
|------|-----------|---------|
| Unit (api.js) | `normalizeMatch`, `mapStatus`, `formatDate`, `formatUtcDate` | Tests unitarios con fixtures mock de API-Football |
| Unit (schedule.js) | `getSchedule` en ambos modos, todas las ventanas horarias, with/without fixtures | Tests paramétricos: mock `Date`, verificar `shouldFetch` y `nextPlanned` |
| Unit (storage.js) | `hasChanges` con iguales vs distintos, escritura/lectura de archivos | Tests con `fs` mock (memfs) para evitar I/O real |
| Integration (pipeline) | `fetch-data.js` con api.js mockeado: verificar que escribe archivos correctos y hace commit solo si cambió | Mock de api + storage; verificar flujo completo |
| Integration (adapter) | Static-first: meta.json presente → usa JSON, ausente → fallback a API | Test con `fetch` mock |
| E2E | gh-pages deployado → frontend carga sin llamadas a API-Football | Manual: deployar gh-pages, abrir DevTools Network, verificar 0 requests a api-sports.io |

## GH Action Setup

```yaml
name: fetch-football-data
on:
  schedule:
    # UTC: */30 14-23 = 11AM-8PM ARG (verano)
    # UTC: */30 0-4 = 9PM-1AM ARG
    - cron: '*/30 14-23,0-4 * * *'
    # Un intento extra a las 6AM ARG (9 UTC) para agenda del día
    - cron: '0 9 * * *'
  workflow_dispatch: {}

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: gh-pages
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Fetch and save data
        run: node scripts/fetch-data.js
        env:
          VITE_API_FOOTBALL_API_KEY: ${{ secrets.API_FOOTBALL_KEY }}

      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain)" ]]; then
            git config user.name "football-calendar-bot"
            git config user.email "bot@football-calendar-bot@users.noreply.github.com"
            git add -A
            git commit -m "data: update $(date +'%Y-%m-%d %H:%M')"
            git push origin gh-pages
          else
            echo "No changes — skipping commit"
          fi
```

**Secretos requeridos en GitHub:**
- `API_FOOTBALL_KEY` — la API key de api-sports.io

## Migration Path

### Fase 1 — Scripts (sin cambios en frontend)
1. Crear `scripts/lib/api.js` — copiar lógica de `apiFootball.js` adaptada a Node.js
2. Crear `scripts/lib/storage.js` — escritura JSON + diff
3. Crear `scripts/schedule.js` — lógica adaptativa
4. Crear `scripts/fetch-data.js` — entry point
5. Crear `.github/workflows/fetch-football-data.yml`

### Fase 2 — Frontend
1. Modificar `src/api/adapter.js` — modo static-first con auto-detección
2. Modificar `src/hooks/useWorldCup.js` — usar adapter en vez de import directo
3. Verificar que `useMatches.js` ya funciona (usa adapter)

### Fase 3 — Ajuste fino
1. Deployar gh-pages, verificar que el frontend carga datos estáticos
2. Monitorear consumo de quota API-Football (< 80 req/día)
3. Calibrar schedules según partidos reales
4. Decidir si agregar live.json para scores más frecuentes

### Migración futura a serverless

`storage.js` es la única pieza que cambia:

```js
// Hoy (gh-pages)
export function saveMatches(date, data) {
  fs.writeFileSync(`data/matches-${date}.json`, JSON.stringify(data));
}

// Mañana (Vercel KV)
export async function saveMatches(date, data) {
  await kv.set(`matches:${date}`, JSON.stringify(data));
  await kv.expire(`matches:${date}`, 60 * 60 * 6); // 6h TTL
}
```

El GH Action se reemplaza por un cron en Vercel Workflows. El frontend no cambia — la API route devuelve los mismos datos.

## Edge Cases

| Caso | Comportamiento |
|------|---------------|
| **Sin partidos hoy** | `schedule.js` retorna `shouldFetch: false`. GH Action corre pero exit(0) sin gastar quota. Un fetch diario adicional verifica si se agregaron partidos. |
| **Error de API (timeout, 429, 500)** | `fetchWithRetry` intenta 3 veces con backoff exponencial (1s, 2s, 3s). Si falla, `fetch-data.js` loggea el error y `exit(1)`. GH Action muestra el error en los logs. No se pierden datos porque los JSONs anteriores siguen en gh-pages. |
| **Cron miss** (GH Action skipped, runner caído) | El próximo cron que corre exitosamente actualiza los datos. El frontent sirve los últimos JSONs disponibles. El desfase máximo es el intervalo del cron + el tiempo hasta el próximo run exitoso. |
| **gh-pages desync con main** | La GH Action checkout explícito a `ref: gh-pages`. Los scripts viven en `main` y se ejecutan desde ahí, pero la rama de trabajo es `gh-pages`. No hay conflicto porque los scripts escriben en `data/` y el resto del repo no se toca. |
| **Primer deploy (gh-pages vacío)** | `loadJSON()` retorna `null` para todos los archivos. `hasChanges()` compara con `null` → todo es cambio. Primer commit escribe todos los JSONs. |
| **Frontend sin gh-pages (desarrollo local)** | `tryFetchStatic('/data/meta.json')` falla (404) → adapter entra en modo fallback → usa API real via proxy. Comportamiento idéntico al actual. |
| **Modo mixto (transición)** | Si gh-pages tiene datos pero el usuario quiere live scores, puede forzar `VITE_DATA_SOURCE=live` para usar API directo. Adapter soporta ambos. |
| **Commit loop por datos inestables** | `hasChanges()` usa deep equality vía `JSON.stringify`. La API-Football devuelve datos determinísticos para fixtures no-live. Los scores en vivo cambian, pero eso es esperado. Si un campo no-determinístico causa loops, se agrega sanitización en `normalizeMatch`. |
| **Rate limit alcanzado** | Si la API responde 429 incluso después de retries, `fetch-data.js` falla. El equipo debe esperar al reset diario (100 req/día). El schedule adaptativo está diseñado para consumir ≤ 80 req/día, dejando margen. |
