# Supabase DB Specification

## Purpose

Define the database schema, RLS policies, seed data, and indexes for the Supabase PostgreSQL database that stores football match data, standings, and pipeline metadata.

## Requirements

### R1 — Schema Migration

The migration SQL MUST define these 7 tables:

| Table | PK | Key Columns | Notes |
|-------|----|-------------|-------|
| `leagues` | `id` (serial) | `api_id` (unique), `name`, `season`, `group_name`, `display_order`, `default_sel` | Reference data, seeded once |
| `teams` | `id` (serial) | `api_id` (unique), `name`, `logo` | Reference data, seeded once |
| `team_rosters` | composite (`league_id`, `team_id`, `season`) | FK → leagues(id), teams(id) | Many-to-many league-team membership |
| `bracket_nodes` | `id` (text) | `round`, `round_index`, `matchup_index`, `home_source`, `away_source`, `candidate_groups`, grid positions | World Cup bracket layout, seeded once |
| `matches` | `id` (text) | `league_id` FK, `home_team_id` FK, `away_team_id` FK, `date` (timestamptz), `status`, scores, `is_knockout` | Dynamic, upserted by Edge Function |
| `standings` | `id` (serial) | `league_id` FK, `team_id` FK, `season`, `group_name`, `rank`, `points`, `played`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `goal_diff` | Dynamic, upserted by Edge Function |
| `pipeline_meta` | `id` (int, default 1) | `last_fetched`, `next_planned`, `mode`, constraint `one_row CHECK (id = 1)` | Single-row scheduler state |

#### Scenario: Clean migration

- GIVEN a fresh Supabase project
- WHEN the migration SQL runs
- THEN all 7 tables exist with correct columns, PKs, FKs, and constraints
- AND `pipeline_meta` contains the initial row `(id=1, mode='worldcup')`

### R2 — Indexes

The migration MUST create these indexes:

- `idx_matches_date` on `matches(date)`
- `idx_matches_league` on `matches(league_id)`
- `idx_matches_status` on `matches(status)`
- `idx_standings_ls` on `standings(league_id, season)`

#### Scenario: Query performance

- GIVEN a populated matches table
- WHEN the Edge Function queries by date or status
- THEN the query uses the correct index (verified via `EXPLAIN`)

### R3 — RLS Policies

All tables MUST enable RLS. These policies MUST apply:

| Table | Policy | Action |
|-------|--------|--------|
| `leagues` | Public read | `FOR SELECT USING (true)` |
| `teams` | Public read | `FOR SELECT USING (true)` |
| `team_rosters` | Public read | `FOR SELECT USING (true)` |
| `bracket_nodes` | Public read | `FOR SELECT USING (true)` |
| `matches` | Public read | `FOR SELECT USING (true)` |
| `standings` | Public read | `FOR SELECT USING (true)` |
| `pipeline_meta` | No policy | No public access |

#### Scenario: Public reads allowed

- GIVEN an anonymous client with the anon key
- WHEN it SELECTs from `matches`, `standings`, `leagues`, `teams`, `team_rosters`, or `bracket_nodes`
- THEN the query succeeds and returns data

#### Scenario: pipeline_meta protected

- GIVEN an anonymous client with the anon key
- WHEN it SELECTs from `pipeline_meta`
- THEN the query returns empty results (RLS blocks)

### R4 — Seed Data

A seed script using `service_role` key MUST:

- Upsert leagues from `leagueConfig.js` (all supported leagues with `api_id`, `name`, `season=2026`, `group_name`, `display_order`, `default_sel`)
- Upsert teams (fetched from API-Football `/teams?league={id}&season=2026` for each league)
- Upsert `team_rosters` entries linking teams to their leagues
- Upsert `bracket_nodes` from the bracket graph (53 rows with grid positions)

#### Scenario: Seed completes

- GIVEN an empty Supabase project with schema applied
- WHEN the seed script runs with `service_role` key
- THEN leagues, teams, team_rosters, and bracket_nodes tables are populated
- AND each league has a valid `api_id` matching API-Football
- AND bracket_nodes contain all expected bracket positions
