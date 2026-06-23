-- =============================================
-- Football Calendar — Seed Data
-- Paste this in Supabase Dashboard → SQL Editor
-- =============================================

-- ── Leagues ────────────────────────────────────
INSERT INTO leagues (api_id, name, logo, season, group_name, display_order, default_sel) VALUES
  (1,   'World Cup 2026',         NULL, 2026, 'Mundial',             1, true),
  (2,   'UEFA Champions League',  NULL, 2026, 'Champions League',    2, true),
  (13,  'Copa Libertadores',       NULL, 2026, 'Copa Libertadores',   3, true),
  (11,  'Copa Sudamericana',      NULL, 2026, 'Copa Libertadores',   4, false),
  (39,  'Premier League',         NULL, 2026, 'Inglaterra',          5, true),
  (45,  'FA Cup',                 NULL, 2026, 'Inglaterra',          6, false),
  (48,  'EFL Cup',               NULL, 2026, 'Inglaterra',          7, false),
  (140, 'LaLiga',                 NULL, 2026, 'España',              8, true),
  (143, 'Copa del Rey',           NULL, 2026, 'España',              9, false),
  (556, 'Supercopa',              NULL, 2026, 'España',              10, false),
  (135, 'Serie A',               NULL, 2026, 'Italia',              11, true),
  (137, 'Coppa Italia',           NULL, 2026, 'Italia',              12, false),
  (78,  'Bundesliga',             NULL, 2026, 'Alemania',            13, true),
  (81,  'DFB-Pokal',              NULL, 2026, 'Alemania',            14, false)
ON CONFLICT (api_id) DO UPDATE SET
  name = EXCLUDED.name, season = EXCLUDED.season,
  group_name = EXCLUDED.group_name, display_order = EXCLUDED.display_order,
  default_sel = EXCLUDED.default_sel;

-- ── Bracket Nodes (World Cup 2026) ─────────────
-- R32 (16 matchups)
INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source, is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col) VALUES
  ('M74', 'R32', 0, 0,  '1°E', NULL,       true,  'A,B,C,D,F',   3,  2, 1),
  ('M77', 'R32', 0, 1,  '1°I', NULL,       true,  'C,D,F,G,H',   5,  2, 1),
  ('M73', 'R32', 0, 2,  '2°A', '2°B',      false, NULL,          7,  2, 1),
  ('M75', 'R32', 0, 3,  '1°F', '2°C',      false, NULL,          9,  2, 1),
  ('M83', 'R32', 0, 4,  '2°K', '2°L',      false, NULL,          11, 2, 1),
  ('M84', 'R32', 0, 5,  '1°H', '2°J',      false, NULL,          13, 2, 1),
  ('M81', 'R32', 0, 6,  '1°D', NULL,       true,  'B,E,F,I,J',   15, 2, 1),
  ('M82', 'R32', 0, 7,  '1°G', NULL,       true,  'A,E,H,I,J',   17, 2, 1),
  ('M76', 'R32', 0, 8,  '1°C', '2°F',      false, NULL,          19, 2, 1),
  ('M78', 'R32', 0, 9,  '2°E', '2°I',      false, NULL,          21, 2, 1),
  ('M79', 'R32', 0, 10, '1°A', NULL,       true,  'C,E,F,H,I',   23, 2, 1),
  ('M80', 'R32', 0, 11, '1°L', NULL,       true,  'E,H,I,J,K',   25, 2, 1),
  ('M86', 'R32', 0, 12, '1°J', '2°H',      false, NULL,          27, 2, 1),
  ('M88', 'R32', 0, 13, '2°D', '2°G',      false, NULL,          29, 2, 1),
  ('M85', 'R32', 0, 14, '1°B', NULL,       true,  'E,F,G,I,J',   31, 2, 1),
  ('M87', 'R32', 0, 15, '1°K', NULL,       true,  'D,E,I,J,L',   33, 2, 1)
ON CONFLICT (id) DO UPDATE SET
  round = EXCLUDED.round, round_index = EXCLUDED.round_index,
  matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
  away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
  candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
  grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col;

-- R16 (8 matchups)
INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source, is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col) VALUES
  ('R16-M1', 'R16', 1, 0, 'M74', 'M77', false, NULL, 4,  4, 3),
  ('R16-M2', 'R16', 1, 1, 'M73', 'M75', false, NULL, 8,  4, 3),
  ('R16-M3', 'R16', 1, 2, 'M83', 'M84', false, NULL, 12, 4, 3),
  ('R16-M4', 'R16', 1, 3, 'M81', 'M82', false, NULL, 16, 4, 3),
  ('R16-M5', 'R16', 1, 4, 'M76', 'M78', false, NULL, 20, 4, 3),
  ('R16-M6', 'R16', 1, 5, 'M79', 'M80', false, NULL, 24, 4, 3),
  ('R16-M7', 'R16', 1, 6, 'M86', 'M88', false, NULL, 28, 4, 3),
  ('R16-M8', 'R16', 1, 7, 'M85', 'M87', false, NULL, 32, 4, 3)
ON CONFLICT (id) DO UPDATE SET
  round = EXCLUDED.round, round_index = EXCLUDED.round_index,
  matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
  away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
  candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
  grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col;

-- QF (4 matchups)
INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source, is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col) VALUES
  ('QF-M1', 'QF', 2, 0, 'R16-M1', 'R16-M2', false, NULL, 6,  8, 5),
  ('QF-M2', 'QF', 2, 1, 'R16-M3', 'R16-M4', false, NULL, 14, 8, 5),
  ('QF-M3', 'QF', 2, 2, 'R16-M5', 'R16-M6', false, NULL, 22, 8, 5),
  ('QF-M4', 'QF', 2, 3, 'R16-M7', 'R16-M8', false, NULL, 30, 8, 5)
ON CONFLICT (id) DO UPDATE SET
  round = EXCLUDED.round, round_index = EXCLUDED.round_index,
  matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
  away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
  candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
  grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col;

-- SF (2 matchups)
INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source, is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col) VALUES
  ('SF-M1', 'SF', 3, 0, 'QF-M1', 'QF-M2', false, NULL, 10, 16, 7),
  ('SF-M2', 'SF', 3, 1, 'QF-M3', 'QF-M4', false, NULL, 26, 16, 7)
ON CONFLICT (id) DO UPDATE SET
  round = EXCLUDED.round, round_index = EXCLUDED.round_index,
  matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
  away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
  candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
  grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col;

-- Final (1 matchup)
INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source, is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col) VALUES
  ('F-M1', 'F', 4, 0, 'SF-M1', 'SF-M2', false, NULL, 18, 4, 9)
ON CONFLICT (id) DO UPDATE SET
  round = EXCLUDED.round, round_index = EXCLUDED.round_index,
  matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
  away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
  candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
  grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col;

SELECT '✅ Seed complete!' AS result;
SELECT COUNT(*) AS leagues FROM leagues;
SELECT COUNT(*) AS bracket_nodes FROM bracket_nodes;
