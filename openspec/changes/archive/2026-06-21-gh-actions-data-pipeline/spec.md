# Especificación: GH Actions Data Pipeline

## Overview

Eliminar el 100% del consumo de quota API-Football en runtime del navegador. Se introduce un pipeline CI/CD que ejecuta scripts Node.js desde un GitHub Action con schedule, persiste los datos como JSON estáticos en la rama `gh-pages`, y el frontend los consume vía fetch a archivos estáticos con fallback transparente a API real. Cero cambios en la UI.

Dos capacidades nuevas:
- **data-pipeline-fetch**: Scripts Node.js + GH Action para fetch, schedule, persistencia y commit condicional.
- **data-pipeline-consumption**: Adaptador frontend que lee de `/data/*.json` con auto-detección y fallback.

Ninguna capacidad existente se modifica — los hooks `useMatches` y `useWorldCup` reciben datos normalizados idénticos.

---

## Requerimientos

### A. Pipeline de Fetch

**A1 — Schedule adaptativo (`scripts/schedule.js`)**
El scheduler DEBE decidir si ejecutar un fetch según hora actual, modo operativo y partidos conocidos.
- Modo MUNDIAL (20-jun al 20-jul 2026): ventana activa 12PM–2AM ART. Fetch cada 2h si hay partidos, cada 15–30min si hay partidos en vivo. Sin partidos en el día → no fetch.
- Modo LIGAS (default): ventana activa 8AM–1AM ART. Fetch cada 30min en horario activo, cada 6h si no hay partidos ese día, cada 15min si hay partidos en vivo.
- Ambos modos: un fetch diario entre 4–6AM exclusivamente para actualizar `schedule.json`.
- Output: `{ shouldFetch: boolean, endpoints: string[], reason: string }`.

**A2 — Cliente API (`scripts/lib/api.js`)**
El wrapper DEBE envolver los mismos endpoints que `src/api/apiFootball.js`: `getMatches(date)`, `getStandings(leagueId, season)`, `getRounds(leagueId, season)`, `getLiveMatches()`. DEBE usar `VITE_API_FOOTBALL_API_KEY` del entorno, implementar `fetchWithRetry` con exponential backoff (3 reintentos, 1s base) y exportar `normalizeMatch` con el mismo formato interno que el frontend.

**A3 — Persistencia con diff (`scripts/lib/storage.js`)**
El módulo DEBE leer/escribir archivos JSON en `data/`. DEBE exponer `saveMatches(date, data)`, `saveStandings(data)`, `saveSchedule(data)`, `saveMeta(data)` y `loadExisting(key)`. DEBE incluir `hasChanges(new, existing)` para comparación profunda. Este es el ÚNICO módulo que cambiaría al migrar a serverless KV/Blob.

**A4 — Entry point (`scripts/fetch-data.js`)**
El script DEBE: (1) leer modo desde env o detectar por fecha, (2) consultar `schedule.js`, (3) si `shouldFetch=false` → `exit(0)` sin IO, (4) llamar `api.js` con los endpoints requeridos, (5) escribir vía `storage.js`, (6) si no hay cambios vs archivos existentes → `exit(0)`.

**A5 — GitHub Action (`.github/workflows/fetch-football-data.yml`)**
El workflow DEBE ejecutarse cada 30 minutos (8AM–1AM ART) más un trigger a las 3AM y `workflow_dispatch` manual. DEBE hacer checkout de `gh-pages`, instalar dependencias, ejecutar `node scripts/fetch-data.js` con `API_FOOTBALL_KEY` desde secrets, y hacer commit+push solo si `git status --porcelain` detecta cambios. El cron DEBE calibrarse en UTC para cubrir el huso argentino (UTC-3).

---

### B. Consumo Estático

**B1 — Adaptador con fuente estática (`src/api/adapter.js`)**
El adaptador DEBE soportar dos modos: `static` (lee de `/data/*.json`) y `live` (llama a API real). El modo DEBE determinarse por la variable de entorno `VITE_DATA_SOURCE`. Si no está definida, DEBE auto-detectar: intentar fetch al JSON estático primero y, si falla (dev sin datos), caer en fallback a API real. El formato de retorno DEBE ser idéntico al actual (`Match[]` normalizado).

**B2 — Hooks transparentes (`src/hooks/useMatches.js`, `src/hooks/useWorldCup.js`)**
Los hooks NO DEBEN requerir cambios en su interfaz pública. `useMatches` DEBE recibir los mismos datos normalizados desde el adaptador, independientemente de la fuente. `useWorldCup` DEBE leer `standings.json` estático cuando el adaptador está en modo static, retornando el mismo formato `{ standings, rounds, loading, error, refetch }`.

**B3 — Cache local secundario**
El cache en localStorage (`fc_matches_*`) DEBE mantenerse como capa secundaria opcional. En modo static, el primer load es más rápido (JSON local vs API), y el cache puede reducir renders.

---

## Escenarios

### Escenario 1: GH Action con partidos programados
- DADO que es 14:00 ART, hay partidos programados, modo LIGAS activo
- CUANDO el GH Action se ejecuta
- ENTONCES `schedule.js` retorna `{ shouldFetch: true, endpoints: [...], reason }`
- Y `api.js` fetchea los datos de API-Football
- Y `storage.js` escribe los JSONs en `data/`
- Y si hay cambios, se commitea y pushea a `gh-pages`

### Escenario 2: GH Action sin cambios en datos
- DADO que los datos no cambiaron respecto al último fetch
- CUANDO `storage.js` compara con los archivos existentes
- ENTONCES `hasChanges()` retorna `false`
- Y `fetch-data.js` hace `exit(0)` sin commit

### Escenario 3: Fetch nocturno de schedule
- DADO que son las 3:00 AM (trigger especial)
- CUANDO el GH Action se ejecuta
- ENTONCES `schedule.js` retorna endpoints solo para `schedule.json`
- Y se hace un único fetch para actualizar la agenda de los próximos 3 días

### Escenario 4: Usuario carga el sitio con datos estáticos
- DADO que `VITE_DATA_SOURCE=static` o el auto-detect encuentra JSONs
- CUANDO el usuario visita la página principal
- ENTONCES `adapter.js` fetchea `/data/matches-{fecha}.json`
- Y `useMatches` recibe los datos normalizados sin llamar a API-Football

### Escenario 5: Fallback a API en desarrollo
- DADO que el usuario está en desarrollo local sin JSONs estáticos
- CUANDO `adapter.js` intenta fetch a `/data/matches-*.json` y falla (404)
- ENTONCES el adaptador cae en fallback a `apiFootball.getMatches()`
- Y el hook recibe datos normalmente

### Escenario 6: Modo Mundial — ventana activa
- DADO que es 1 de julio 2026, 13:00 ART, hay partidos de Mundial
- CUANDO el GH Action se ejecuta
- ENTONCES `schedule.js` detecta modo MUNDIAL, hora dentro de ventana 12PM–2AM
- Y retorna `shouldFetch: true` con los endpoints correspondientes

### Escenario 7: Modo Mundial — fuera de ventana
- DADO que es 1 de julio 2026, 10:00 ART
- CUANDO el GH Action se ejecuta
- ENTONCES `schedule.js` detecta que está fuera de la ventana activa (12PM–2AM)
- Y retorna `shouldFetch: false` con reason "fuera de ventana activa"
- Y el script termina sin gastar quota de API

### Escenario 8: Modo Ligas — sin partidos, intervalo largo
- DADO que es un lunes a las 22:00, no hay partidos programados
- CUANDO el GH Action se ejecuta
- ENTONCES `schedule.js` detecta modo LIGAS, sin partidos hoy
- Y retorna `shouldFetch: true` solo si pasaron 6h desde el último fetch
- Y solo fetchea `schedule.json` (1–2 requests)

### Escenario 9: Migración a serverless
- DADO que se decide migrar de gh-pages a Vercel KV
- CUANDO se reemplaza `scripts/lib/storage.js` por una implementación que usa `@vercel/kv`
- ENTONCES el resto del pipeline (`schedule.js`, `api.js`, `fetch-data.js`) NO requiere cambios
- Y el frontend sigue recibiendo los mismos datos normalizados
