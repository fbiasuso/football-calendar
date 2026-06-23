# Delta for data-pipeline

## ADDED Requirements

### C — Supabase Write Target

The data pipeline MUST support Supabase DB as an additional write target alongside the existing JSON file storage. The `scripts/lib/storage.js` module SHALL expose an optional Supabase writer:

- `saveMatchesToSupabase(supabaseClient, matches[])` — upserts matches
- `saveStandingsToSupabase(supabaseClient, standings[])` — upserts standings

These functions MUST be no-ops when no Supabase client is provided. The pipeline MUST continue to write JSON files as before; Supabase writes are additive, not a replacement.

#### Scenario: Supabase client provided

- GIVEN `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available
- WHEN `storage.saveMatchesToSupabase(client, data)` is called
- THEN matches are upserted to the Supabase matches table
- AND JSON files are still written to `data/` as before

#### Scenario: No Supabase client

- GIVEN no Supabase client is provided
- WHEN the pipeline runs
- THEN the Supabase write functions are no-ops
- AND the pipeline behaves identically to the current state

### D — Supabase Consumption Source

The frontend adapter MUST support Supabase as an additional consumption source. The adapter determines the source at module load time:

1. If `VITE_SUPABASE_URL` is set → use `supabaseAdapter`
2. Else if static JSON files are detected → use `staticAdapter` (existing B1)
3. Else → fallback to `apiFootballAdapter` (live API)

This replaces the previous dual-mode (static/live) with tri-mode (supabase/static/live).

#### Scenario: Frontend reads from Supabase

- GIVEN `VITE_SUPABASE_URL` is set in the frontend environment
- WHEN the app loads matches for today
- THEN `adapter.js` calls `supabaseAdapter.getMatches(date)`
- AND the hook receives the same normalized data shape

## MODIFIED Requirements

### B1 — Adaptador con fuente estática

The adapter MUST support THREE modes: `supabase` (reads from Supabase via supabase-js), `static` (reads from `/data/*.json`), and `live` (calls API-Football directly). The mode SHALL be determined by checking `VITE_SUPABASE_URL` first, then falling back to static detection, then live API.

(Previously: supported only `static` and `live` modes determined by `VITE_DATA_SOURCE` or auto-detect)

#### Scenario: Supabase preferred over static

- GIVEN `VITE_SUPABASE_URL` is set AND static JSON files exist
- WHEN the adapter initializes
- THEN it selects supabase mode (supabase takes priority)
- AND returns data from Supabase, not from JSON files

#### Scenario: All sources unavailable

- GIVEN no `VITE_SUPABASE_URL`, no static JSONs, and API-Football is unreachable
- WHEN the adapter initializes
- THEN it falls through all modes and throws a descriptive error

## MODIFIED Requirements

### Escenario 9: Migración a Supabase — reemplazo de storage

- DADO que se decide migrar de gh-pages a Supabase
- CUANDO se agrega un writer a Supabase en `scripts/lib/storage.js`
- ENTONCES `schedule.js` y `api.js` NO requieren cambios
- Y el frontend puede consumir desde Supabase (cuando `VITE_SUPABASE_URL` está definida) o desde JSON estáticos (fallback)
- Y el formato de datos normalizados es idéntico independientemente de la fuente

(Previously: referenced Vercel KV as the migration target)
