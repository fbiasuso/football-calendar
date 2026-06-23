# Supabase Consumption Specification

## Purpose

Define the frontend adapter layer that consumes data from Supabase via the `@supabase/supabase-js` client, replacing the static JSON fetch from gh-pages while preserving the same normalized data shape.

## Requirements

### R1 — Client Initialization

A `src/lib/supabase.js` module MUST export a Supabase client initialized with:

```
URL:  import.meta.env.VITE_SUPABASE_URL
ANON: import.meta.env.VITE_SUPABASE_ANON_KEY
```

#### Scenario: Client created

- GIVEN `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env`
- WHEN `src/lib/supabase.js` is imported
- THEN it exports a valid Supabase client instance

### R2 — getMatches(date)

MUST query `matches` table with JOINs to `leagues` (name, logo) and `teams` (home, away name + logo). MUST filter by date range (start of day to start of next day in UTC). MUST normalize output to the existing `Match[]` shape:

```javascript
{ id, date, league, leagueId,
  teams: { home: { name, badge, id }, away: { name, badge, id } },
  status, score: { home, away }, minute, round, isKnockout, season }
```

#### Scenario: Matches returned for a day

- GIVEN the Supabase DB has matches for 2026-06-23
- WHEN `getMatches('2026-06-23')` is called
- THEN it returns a normalized array of matches for that day

### R3 — getLiveMatches()

MUST query `matches` where `status = 'live'`. MUST return the same normalized `Match[]` shape.

#### Scenario: Live matches exist

- GIVEN there are matches with status 'live' in the DB
- WHEN `getLiveMatches()` is called
- THEN it returns only live matches with normalized shape

### R4 — getStandings(leagueId, season)

MUST query `standings` filtered by `league_id` and `season`, grouped by `group_name`. MUST return `{ groups: { [groupName]: StandingRow[] } }` where each StandingRow has `{ rank, team: { name, logo, id }, points, played, wins, draws, losses, goalsFor, goalsAgainst, goalDiff }`.

#### Scenario: Standings returned

- GIVEN standings exist for league 1, season 2026
- WHEN `getStandings(1, 2026)` is called
- THEN it returns standings grouped by group_name with normalized shape

### R5 — getBracketNodes()

MUST query all rows from `bracket_nodes` table, ordered by `round_index, matchup_index`. MUST return `BracketNode[]` with all columns.

#### Scenario: Bracket nodes returned

- GIVEN bracket_nodes are seeded in the DB
- WHEN `getBracketNodes()` is called
- THEN it returns all bracket nodes in display order

### R6 — Adapter Switching (adapter.js)

The existing `src/api/adapter.js` MUST detect `VITE_SUPABASE_URL` at module load time. If present AND non-empty, all exported functions (`getMatches`, `getLiveMatches`, `getStandings`, `getBracketNodes`) MUST delegate to `supabaseAdapter`. If absent, MUST fall back to `apiFootballAdapter` (live API calls).

No changes to hooks (`useMatches`, `useLeagues`, `useWorldCup`) — they continue to call `adapter.js` and receive identical data shapes.

#### Scenario: Supabase enabled

- GIVEN `VITE_SUPABASE_URL=https://xyz.supabase.co` is set
- WHEN `adapter.getMatches(date)` is called
- THEN it delegates to `supabaseAdapter.getMatches(date)`
- AND returns normalized data

#### Scenario: Supabase disabled (fallback)

- GIVEN `VITE_SUPABASE_URL` is not set (empty or undefined)
- WHEN `adapter.getMatches(date)` is called
- THEN it delegates to `apiFootballAdapter.getMatches(date)`
- AND the app works exactly as before

#### Scenario: Query error from Supabase

- GIVEN the Supabase service is unreachable
- WHEN any adapter function is called
- THEN it SHOULD throw a descriptive error
- AND the calling hook SHOULD surface it via its `error` state
