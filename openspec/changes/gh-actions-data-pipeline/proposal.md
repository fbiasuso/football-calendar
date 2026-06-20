# Propuesta: GH Actions Data Pipeline

## Intención

Eliminar el 100% del consumo de quota API-Football en runtime. Hoy cada visitante gasta requests del free tier (100 req/día compartidos). La solución mueve todos los fetch a un GitHub Action con schedule, que guarda JSONs estáticos en la rama `gh-pages`. El frontend lee de `/data/*.json` — cero llamadas a la API desde el navegador.

## Alcance

### Incluye
- Scripts Node.js para fetch, schedule y storage (`scripts/`)
- GH Action con cron para ejecutar los scripts cada 30 min
- Commit condicional: solo si los datos cambiaron (sin bloat en git history)
- Modo MUNDIAL (jun-jul 2026, 12PM-2AM, frec 2h) y modo LIGAS (8AM-1AM, frec 30 min)
- Adaptador frontend que lee estático con fallback a API (dev)
- `storage.js` como única pieza migrable a serverless (Vercel KV, etc.)

### Excluye
- Live scores en tiempo real (se aceptan 2h de desfase)
- SQLite, WASM, IndexedDB o cualquier base del lado cliente
- WebSockets, push subscriptions
- Cambios en UI/componentes React

## Capacidades

### Nuevas
- `data-pipeline-fetch`: Scripts Node.js que corren en GH Action, deciden cuándo fetch según schedule, llaman a API-Football, y persisten JSONs a `gh-pages`. Commit solo en cambios.
- `data-pipeline-consumption`: Adapter frontend que lee de `/data/*.json` con detección automática y fallback a API real. Transparente para hooks y componentes.

### Modificadas
Ninguna — los hooks `useMatches` y `useWorldCup` reciben datos normalizados idénticos.

## Enfoque

1. **scripts/lib/api.js** — Wrapper de API-Football (reusa lógica de `apiFootball.js`)
2. **scripts/schedule.js** — Decide si fetch según hora, modo, partidos conocidos
3. **scripts/lib/storage.js** — Escribe JSON a `./data/`, compara con versión anterior
4. **scripts/fetch-data.js** — Entry point: schedule → api → storage
5. **`.github/workflows/fetch-football-data.yml`** — Cron cada 30 min + `workflow_dispatch`
6. **`src/api/adapter.js`** — Modo static: fetch(`/data/*.json`), fallback a API
7. **`src/hooks/useMatches.js`** — Soporta fuente estática (sin cambios de interfaz)
8. **`src/hooks/useWorldCup.js`** — Lee standings desde JSON estático

## Áreas Afectadas

| Archivo | Impacto | Descripción |
|---------|---------|-------------|
| `scripts/fetch-data.js` | 🆕 Nuevo | Entry point del pipeline |
| `scripts/schedule.js` | 🆕 Nuevo | Lógica de schedule adaptativo |
| `scripts/lib/api.js` | 🆕 Nuevo | Wrapper API-Football para scripts |
| `scripts/lib/storage.js` | 🆕 Nuevo | Persistencia JSON + diff |
| `.github/workflows/fetch-football-data.yml` | 🆕 Nuevo | GH Action definition |
| `src/api/adapter.js` | ✏️ Modificado | Modo static + auto-detección |
| `src/hooks/useMatches.js` | ✏️ Modificado | Soporte fuente estática |
| `src/hooks/useWorldCup.js` | ✏️ Modificado | Lee standings de JSON |

## Riesgos

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| API key expuesta si se commitea al repo | Baja | GitHub Secrets + `.env` en `.gitignore` |
| gh-pages branch se desync con main | Baja | GH Action checkout explícito a `ref: gh-pages` |
| Cron mal calibrado (hora UTC vs ARG) | Media | Ajustar en implementación con zona horaria explícita |
| Commit loop si datos siempre "cambian" | Baja | Diff estricto antes de commit |

## Rollback

Revertir `src/api/adapter.js`, `src/hooks/useMatches.js`, `src/hooks/useWorldCup.js`. Eliminar `scripts/` y `.github/workflows/fetch-football-data.yml`. Eliminar rama `gh-pages` si existe. Volver a `.env.production` con API key en frontend.

## Dependencias

- GitHub Secrets configurado con `API_FOOTBALL_KEY`
- Repo público (GH Actions gratis para runners standard)
- Node 20+ disponible en el runner

## Criterios de Éxito

- [ ] Frontend carga partidos desde `/data/matches-*.json` sin llamadas a API-Football
- [ ] GH Action corre en schedule y solo commitea cuando hay cambios reales
- [ ] Sin cambios en la UI — misma experiencia para el usuario
- [ ] `VITE_DATA_SOURCE=live` funciona como fallback en desarrollo
- [ ] Consumo de quota API-Football ≤ 80 req/día
