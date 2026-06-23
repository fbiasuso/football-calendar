# Design: Supabase Migration

## Technical Approach

Port the GH Actions data pipeline to a Supabase Edge Function (Deno) triggered by cron-job.org, and switch the frontend to read from Supabase via `@supabase/supabase-js` with RLS public reads. The existing `adapter.js` detects `VITE_SUPABASE_URL` at module load time to select the data source. The static JSON pipeline on `main` remains untouched as a rollback path.

## Architecture Decisions

### Decision: Single Edge Function over multiple

| Option | Tradeoff | Decision |
|--------|----------|----------|
| One function per concern (fetch, schedule, standings) | Higher latency per cycle, more deploy complexity | ❌ |
| Single `fetch-data` function | 1 deploy, 10s timeout is sufficient for 1-2 API calls | ✅ |

**Rationale**: The 10s Edge Function timeout easily covers 2 API-Football calls + DB upserts. A single function keeps the deploy surface small.

### Decision: Scheduler state in `pipeline_meta` over meta.json

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `meta.json` on gh-pages | Requires HTTP fetch, stale data, not atomic | ❌ |
| `pipeline_meta` DB row | Single row, ACID, always consistent with current state | ✅ |

### Decision: cron-job.org over Supabase DB Cron

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Supabase pg_cron | Requires Supabase add-on, less flexible HTTP triggers | ❌ |
| cron-job.org free tier | ~1800 execs/month vs 100k cap, simple POST scheduling | ✅ |

### Decision: Env-var switching over config file

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Config file `VITE_DATA_SOURCE=supabase` | More verbose, needs schema docs | ❌ |
| Env var presence `VITE_SUPABASE_URL` | Self-documenting, no extra config surface | ✅ |

## Data Flow

```
cron-job.org (cada 30-60 min)
     │  POST
     ▼
supabase/functions/fetch-data/index.ts
     │
     ├─ 1. Deno.env.get(SUPABASE_SERVICE_ROLE_KEY, VITE_API_FOOTBALL_API_KEY)
     ├─ 2. Create supabase client (service_role)
     ├─ 3. Read pipeline_meta (mode, last_fetched, next_planned)
     ├─ 4. schedule.ts → shouldFetch? endpoints?
     │
     └─ if yes ──→ api.ts ──→ API-Football ──→ db.ts ──→ Supabase DB
                                                      │
                                                      ├─ matches (upsert)
                                                      ├─ standings (upsert)
                                                      └─ pipeline_meta (update)

React App (Vite)
     │  supabase-js (anon key + RLS)
     ▼
src/api/supabaseAdapter.js ──→ Supabase DB (SELECT)
     │                             │
     └─ adapter.js switchea        ├─ leagues, teams, team_rosters
       via VITE_SUPABASE_URL       ├─ matches, standings
                                   └─ bracket_nodes
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/001_schema.sql` | Create | 7 tables + indexes + RLS policies |
| `supabase/functions/fetch-data/index.ts` | Create | Entry point: secrets, pipeline_meta, orchestration |
| `supabase/functions/fetch-data/schedule.ts` | Create | Port of `scripts/schedule.js` to Deno/TS |
| `supabase/functions/fetch-data/api.ts` | Create | Port of `scripts/lib/api.js` to Deno/TS |
| `supabase/functions/fetch-data/db.ts` | Create | DB upsert functions + pipeline_meta updates |
| `scripts/seed-supabase.js` | Create | One-time seed: leagues, teams, team_rosters, bracket_nodes |
| `src/lib/supabase.js` | Create | Supabase client init with anon key |
| `src/api/supabaseAdapter.js` | Create | Query layer matching normalized Match[] shape |
| `src/api/adapter.js` | Modify | Add `VITE_SUPABASE_URL` detection → delegate to supabaseAdapter |
| `package.json` | Modify | Add `@supabase/supabase-js` dependency |
| `.env.example` | Modify | Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Interfaces / Contracts

### Edge Function response shape

```typescript
interface FetchDataResponse {
  fetched: boolean;
  reason: string;
  matchesUpserted: number;
  standingsUpserted: boolean;
}
```

### supabaseAdapter query contract

Same `Match[]` shape as `apiFootball.js`:

```typescript
interface Match {
  id: string;
  date: number;           // Unix ms
  league: string;         // Display name
  leagueId: number;
  teams: {
    home: { name: string; badge: string; id: number };
    away: { name: string; badge: string; id: number };
  };
  status: 'pending' | 'live' | 'finished';
  score: { home: number | null; away: number | null };
  minute: number | null;
  round: string | null;
  isKnockout: boolean;
  season: number | null;
}
```

### Adapter switching contract

```javascript
// src/api/adapter.js — added at top, no async needed
const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;

export async function getMatches(date) {
  if (useSupabase) return supabaseAdapter.getMatches(date);
  // ... existing static/live fallback logic unchanged
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Edge Function unit | schedule.ts port | `deno test` — same fixtures as `scripts/schedule.js` |
| Edge Function integration | API client + db.ts | Mock API-Football, verify upsert calls |
| Frontend unit | supabaseAdapter | Vitest with mocked supabase client |
| Frontend integration | adapter.js switching | Simulate env var presence/absence |
| E2E | Full frontend with Supabase | Manual: load app with Supabase env, compare output |

## Migration / Rollout

| Phase | What | When |
|-------|------|------|
| 1 | Schema + seed in Supabase project | Day 1 |
| 2 | Edge Function (Deno) + cron-job.org config | Day 1-2 |
| 3 | Frontend adapter with env-var switching | Day 2-3 |
| 4 | Test on `develop` branch (main unchanged) | Day 3-7 |
| 5 | Merge develop → main, disable GH Actions | After 1 week stable |

Rollback is instant: remove `VITE_SUPABASE_URL` from `.env`, app falls back to static/live mode on `main`.

## Open Questions

- [ ] Should `seed-supabase.js` also fetch all 48 World Cup teams from API-Football, or is it acceptable to populate teams progressively as matches arrive?
- [ ] cron-job.org: should we configure per-league endpoints via URL params, or keep a single POST to the function and let schedule.ts decide?
