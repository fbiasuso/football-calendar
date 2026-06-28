-- 004_add_optimization_columns.sql — Track fetch timing for cache-aware scheduling
--
-- Changes:
--   1. Add standings_last_fetched to pipeline_meta (avoid refetching every cycle)
--   2. Add fixture_fetch_cache jsonb (per-date last-fetched timestamps)
--
-- Apply via: supabase migration up (or paste in Supabase SQL Editor)

-- ── 1. Standings last-fetched timestamp ────────────────────────────────────

ALTER TABLE pipeline_meta
  ADD COLUMN IF NOT EXISTS standings_last_fetched timestamptz;

-- ── 2. Per-date fixture fetch cache ────────────────────────────────────────

ALTER TABLE pipeline_meta
  ADD COLUMN IF NOT EXISTS fixture_fetch_cache jsonb NOT NULL DEFAULT '{}'::jsonb;

SELECT '✅ Migration 004 complete!' AS result;
