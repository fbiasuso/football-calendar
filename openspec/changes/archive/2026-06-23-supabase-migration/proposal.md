# Proposal: Supabase Migration

## Intent

Eliminar dependencia de GH Actions cron (pipeline inestable con atrasos de horas). Reducir calls a API-Football de ~84/día a ~50-68/día. Reemplazar gh-pages JSON estáticos con Supabase DB + Edge Function (Deno) + cron-job.org para scheduling.

## Scope

### In Scope
- Schema SQL (7 tablas: leagues, teams, team_rosters, bracket_nodes, matches, standings, pipeline_meta) + RLS
- Seed script para datos estáticos (leagues, teams, bracket_nodes)
- Edge Function `fetch-data` (Deno) portando schedule.js + API client
- Frontend: `src/lib/supabase.js`, `src/api/supabaseAdapter.js`, switching en `adapter.js`
- Branch: `develop` (main sigue con GH Actions hasta merge)

### Out of Scope
- Auth system (anon key + RLS suficiente para lectura pública)
- Bracket user picks (siguen en localStorage)
- UI changes o modificaciones en hooks (reciben datos normalizados idénticos)
- GH Actions cleanup (fase 4, post-migración)

## Capabilities

### New Capabilities
- `supabase-db`: schema migration, seed, RLS policies
- `edge-function-fetch`: Deno Edge Function con fetch + upsert + scheduler state
- `supabase-consumption`: frontend adapter via supabase-js client

### Modified Capabilities
- `data-pipeline`: fuente cambia de GH Actions/gh-pages a Edge Function + cron-job.org. La especificación de consumo necesita un nuevo escenario de fuente Supabase (el escenario 9 existente "Migración a serverless" anticipa este cambio)

## Approach

1. **Schema + Seed**: migration SQL (7 tablas, RLS público), seed script Node.js para leagues/teams/bracket_nodes
2. **Edge Function**: portar `schedule.js` + `api.js` a Deno, escribir en `matches`/`standings`, gestionar `pipeline_meta` para nextPlanned
3. **Scheduling**: cron-job.org POST cada 30-60 min a `https://<ref>.supabase.co/functions/v1/fetch-data`
4. **Frontend**: `@supabase/supabase-js`, adaptador con queries normalizados, `adapter.js` switchea por env var `VITE_SUPABASE_URL`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/*.sql` | New | Schema + RLS |
| `supabase/functions/fetch-data/` | New | Edge Function (4 files) |
| `scripts/seed-supabase.js` | New | Static data seed |
| `src/lib/supabase.js` | New | Client init |
| `src/api/supabaseAdapter.js` | New | Supabase queries |
| `src/api/adapter.js` | Modified | Source switching (env var detection) |
| `package.json` | Modified | Add `@supabase/supabase-js` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Edge Function timeout (10s Supabase limit) | Low | 1-2 API calls/run, well under limit |
| cron-job.org free tier limits | Low | ~1800 execs/month vs 100k cap |
| Deno compat issues (npm specifiers) | Low | `npm:@supabase/supabase-js` works in Edge Functions |
| GH Actions breaks while develop diverges | Low | main untouched, GH Actions sigue activo |

## Rollback Plan

1. `main` mantiene GH Actions pipeline intacto — cero riesgo en producción
2. `develop`: `adapter.js` mantiene `apiFootball.js` como fallback si `VITE_SUPABASE_URL` no está definida
3. Edge Function: si falla en producción, el frontend nunca recibe datos stale (matches no updatadas) — no hay datos corruptos
4. Merge a `main` solo tras 1 semana de ejecuciones estables de la Edge Function

## Dependencies

- Supabase project (URL + anon key + service_role key)
- cron-job.org account (free tier)
- API-Football key (existente, sin cambios)

## Success Criteria

- [ ] Edge Function ejecuta en schedule sin errores
- [ ] Frontend carga matches desde Supabase (sin fetch a gh-pages)
- [ ] Standings y bracket nodes renderizan correctamente
- [ ] Cero calls a API-Football desde el navegador (solo server-side)
- [ ] Sin regresiones en UI vs `main` actual
