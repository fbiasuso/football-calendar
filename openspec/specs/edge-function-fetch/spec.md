# Edge Function Fetch Specification

## Purpose

Define the Supabase Edge Function (Deno) that replaces the GH Actions pipeline. It receives scheduled POST requests from cron-job.org, queries API-Football, and upserts data into the Supabase database.

## Requirements

### R1 — Entry Point (index.ts)

The function MUST expose a single POST endpoint at `/functions/v1/fetch-data`. On invocation it SHALL:

1. Read secrets from `Deno.env`: `SUPABASE_SERVICE_ROLE_KEY`, `VITE_API_FOOTBALL_API_KEY`
2. Create a Supabase client using the service_role key
3. Read `pipeline_meta` row (last_fetched, next_planned, mode)
4. Call schedule logic to determine if fetch is needed
5. If fetch needed: call API-Football endpoints, upsert to DB, update pipeline_meta
6. Return HTTP 200 with `{ fetched: true|false, reason }`

#### Scenario: Normal invocation

- GIVEN a POST request to the function endpoint
- WHEN the function executes
- THEN it reads secrets, pipeline_meta, and proceeds to schedule check
- AND returns a 200 response

### R2 — Schedule Logic (schedule.ts)

SHOULD port the logic from `scripts/schedule.js` to Deno TypeScript. MUST determine `shouldFetch`, `endpoints`, and `reason` based on:

- `pipeline_meta.mode` (worldcup | leagues)
- Current time vs active window (worldcup: 12PM-2AM ART, leagues: 8AM-1AM ART)
- `knownFixtures` = count of today's matches in DB
- `lastFetched` from pipeline_meta
- Live matches currently in progress

#### Scenario: Active window with matches

- GIVEN mode=leagues, active window, knownFixtures > 0
- WHEN schedule logic runs
- THEN `shouldFetch=true`, endpoints include `/fixtures?date=today`

#### Scenario: Outside active window

- GIVEN current time outside the mode's active window
- WHEN schedule logic runs
- THEN `shouldFetch=false`, reason includes "fuera de ventana activa"

### R3 — API Client (api.ts)

MUST wrap API-Football REST endpoints using native `fetch`:

- `getMatches(date)` → GET `/fixtures?date={YYYY-MM-DD}`
- `getLiveMatches()` → GET `/fixtures?live=all`
- `getStandings(leagueId, season)` → GET `/standings?league={id}&season={YYYY}`

MUST implement `fetchWithRetry` (3 retries, 1s base exponential backoff). MUST normalize match data to the same internal format used by the frontend.

#### Scenario: API returns data

- GIVEN a valid API-Football key and active season
- WHEN `getMatches('2026-06-23')` is called
- THEN it returns normalized match array with retry logic

#### Scenario: API returns error

- GIVEN API-Football returns 429 (rate limited)
- WHEN `getMatches` is called
- THEN retry mechanism triggers with exponential backoff
- AND if all retries fail, the error is caught and logged

### R4 — DB Writes (db.ts)

MUST upsert data using the service_role Supabase client:

- `upsertMatches(matches[])` → upsert into `matches` table
- `upsertStandings(standings[])` → upsert into `standings` table (unique on league_id, season, group_name, team_id)
- `updatePipelineMeta({ last_fetched, next_planned })` → update the single pipeline_meta row

Limit: 1-2 API-Football calls per run (live + today fixtures). Standings fetched at most every 4 hours.

#### Scenario: Data upserted

- GIVEN normalized match data from API-Football
- WHEN `upsertMatches` is called
- THEN matches are inserted or updated (on conflict)
- AND pipeline_meta.last_fetched is updated to now()

### R5 — Secrets & Security

The function MUST read these from `Deno.env` (set via Supabase dashboard or `supabase secrets set`):

- `SUPABASE_SERVICE_ROLE_KEY` — for DB writes
- `VITE_API_FOOTBALL_API_KEY` — for API-Football calls

The function endpoint MAY accept unauthenticated requests (cron-job.org cannot pass custom auth headers reliably). Security relies on the service_role key being internal to the Edge Function only.

#### Scenario: Secrets configured

- GIVEN secrets are set in Supabase
- WHEN the function reads `Deno.env.get('VITE_API_FOOTBALL_API_KEY')`
- THEN it returns the configured value

#### Scenario: Missing secret

- GIVEN a secret is not configured
- WHEN the function tries to read it
- THEN the function returns 500 with an error message
