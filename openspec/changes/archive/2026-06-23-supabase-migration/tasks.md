# Tasks: Supabase Migration

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~740 (9 new files, 3 modified) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Infra → PR 2: Edge Function → PR 3: Frontend → PR 4: Cleanup |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB schema + seed script | PR 1 | Base branch: `develop`; foundational, others depend on it |
| 2 | Edge Function (Deno) | PR 2 | Base: `develop`; depends on PR 1 (needs schema), independent from PR 3 |
| 3 | Frontend adapter + switching | PR 3 | Base: `develop`; depends on PR 1 (needs schema), independent from PR 2 |
| 4 | Cleanup GH Actions workflow | PR 4 | Base: `develop`; final, after all stable |

## Phase 1: Infrastructure — DB Schema & Seed

- [x] 1.1 Create `supabase/migrations/001_schema.sql` with 7 tables (`leagues`, `teams`, `team_rosters`, `bracket_nodes`, `matches`, `standings`, `pipeline_meta`), 4 indexes, and RLS public-read policies
- [x] 1.2 Create `scripts/seed-supabase.js` — upsert leagues from `leagueConfig.js`, fetch teams from API-Football per league, populate `team_rosters` and `bracket_nodes` (31 bracket matchups)
- [x] 1.3 Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.example`
- [x] 1.4 Add `@supabase/supabase-js` to `package.json` dependencies

## Phase 2: Edge Function — Deno Data Pipeline

- [x] 2.1 Create `supabase/functions/fetch-data/index.ts` — entry point reading secrets, orchestrating schedule → fetch → upsert cycle
- [x] 2.2 Create `supabase/functions/fetch-data/schedule.ts` — port of `scripts/schedule.js` to Deno/TS (mode detection, active window, `knownFixtures` from DB)
- [x] 2.3 Create `supabase/functions/fetch-data/api.ts` — API-Football client with `fetchWithRetry` (3 retries, exponential backoff), `getMatches`, `getLiveMatches`, `getStandings`
- [x] 2.4 Create `supabase/functions/fetch-data/db.ts` — `upsertMatches`, `upsertStandings`, `updatePipelineMeta` using service_role client
- [x] 2.5 Write `deno test` for `schedule.ts` with same fixture scenarios as original `schedule.js` tests
- [x] 2.6 Write `deno test` for `api.ts` (mock API-Football) + `db.ts` (mock supabase client) integration

## Phase 3: Frontend — Supabase Consumption

- [x] 3.1 Create `src/lib/supabase.js` — export `supabase` client from `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- [x] 3.2 Create `src/api/supabaseAdapter.js` — `getMatches(date)`, `getLiveMatches()`, `getStandings(leagueId, season)`, `getBracketNodes()` with normalized Match[] shape and JOINs
- [x] 3.3 Modify `src/api/adapter.js` — add `const useSupabase = !!import.meta.env.VITE_SUPABASE_URL` at top, delegate all 4 functions to `supabaseAdapter` when set
- [x] 3.4 Write Vitest tests for `supabaseAdapter` (mock supabase client, verify normalized output shape per R2–R5 scenarios)

## Phase 4: Cleanup — GH Actions Decommission

- [x] 4.1 Comment out `.github/workflows/fetch-football-data.yml` (file kept for rollback)
- [x] 4.2 Remove `scripts/schedule.js`, `scripts/fetch-data.js`, `scripts/lib/`, and `scripts/__tests__/` (only `seed-supabase.js` remains)
