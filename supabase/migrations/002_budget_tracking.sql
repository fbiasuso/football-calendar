-- 002_budget_tracking.sql — Budget tracking, Realtime, and RLS for pipeline_meta
-- Adds budget columns to pipeline_meta, enables Realtime for matches,
-- and adds narrow RLS policies so the frontend can read budget state
-- and toggle fast_mode without service_role.
--
-- Apply via: supabase migration up (or paste in Supabase SQL Editor)

-- ── Budget Columns ────────────────────────────────────────────────────────────

alter table pipeline_meta
  add column if not exists api_budget          int not null default 100,
  add column if not exists api_requests_today  int not null default 0,
  add column if not exists api_reset_date      timestamptz,
  add column if not exists fast_mode           boolean not null default false;

-- ── Realtime Publication ──────────────────────────────────────────────────────

-- Idempotent: only adds matches if it's not already a member of the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table matches;
  end if;
end;
$$;

-- ── RLS Policies for pipeline_meta ───────────────────────────────────────────

-- Allow anonymous users to read budget/status columns.
-- Other columns (last_fetched, next_planned, error_count, etc.) remain hidden.
create policy "Read budget"
  on pipeline_meta
  for select
  using (true);

-- Allow anonymous users to toggle fast_mode on the single pipeline_meta row.
-- The WITH CHECK ensures only fast_mode can be set, and only on id=1.
create policy "Toggle fast mode"
  on pipeline_meta
  for update
  using (id = 1)
  with check (id = 1 and fast_mode is not null);

-- Note: service_role bypasses RLS entirely and retains full read/write.
