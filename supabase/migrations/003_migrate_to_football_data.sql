-- 003_migrate_to_football_data.sql — Migrate from API-Football IDs to football-data.org IDs
--
-- Changes:
--   1. Update leagues.api_id to football-data.org competition IDs
--   2. Remove leagues not supported by football-data.org (Copa Sudamericana, Supercopa)
--   3. Insert Argentine Liga Profesional
--   4. Clear World Cup standings (will re-bootstrap from API on next fetch)
--
-- Apply via: supabase migration up (or paste in Supabase SQL Editor)

-- ── 1. Update api_id to football-data.org v4 competition IDs ──────────────

UPDATE leagues SET api_id = 2000 WHERE name = 'World Cup 2026';
UPDATE leagues SET api_id = 2001 WHERE name = 'UEFA Champions League';
UPDATE leagues SET api_id = 2152 WHERE name = 'Copa Libertadores';
UPDATE leagues SET api_id = 2021 WHERE name = 'Premier League';
UPDATE leagues SET api_id = 2055 WHERE name = 'FA Cup';
UPDATE leagues SET api_id = 2139 WHERE name = 'EFL Cup';
UPDATE leagues SET api_id = 2014 WHERE name = 'LaLiga';
UPDATE leagues SET api_id = 2079 WHERE name = 'Copa del Rey';
UPDATE leagues SET api_id = 2019 WHERE name = 'Serie A';
UPDATE leagues SET api_id = 2122 WHERE name = 'Coppa Italia';
UPDATE leagues SET api_id = 2002 WHERE name = 'Bundesliga';
UPDATE leagues SET api_id = 2011 WHERE name = 'DFB-Pokal';

-- ── 2. Remove unsupported leagues ─────────────────────────────────────────

DELETE FROM leagues WHERE name = 'Copa Sudamericana';
DELETE FROM leagues WHERE name = 'Supercopa';

-- ── 3. Insert Argentine Liga Profesional ───────────────────────────────────

INSERT INTO leagues (api_id, name, logo, season, group_name, display_order, default_sel)
VALUES (2024, 'Argentine Liga Profesional', NULL, 2026, 'Argentina', 3, true)
ON CONFLICT (api_id) DO UPDATE SET
  name = EXCLUDED.name, season = EXCLUDED.season,
  group_name = EXCLUDED.group_name, display_order = EXCLUDED.display_order,
  default_sel = EXCLUDED.default_sel;

-- ── 4. Clear World Cup standings (will re-bootstrap) ───────────────────────

DELETE FROM standings
WHERE league_id = (SELECT id FROM leagues WHERE name = 'World Cup 2026');

SELECT '✅ Migration 003 complete!' AS result;
