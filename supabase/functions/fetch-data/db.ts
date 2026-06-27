// db.ts — Direct Postgres queries via npm:pg
// Uses SUPABASE_DB_URL (pre-set by Supabase Edge Function runtime)
// to bypass PostgREST, which blocks new-format secret keys.

import pg from "npm:pg@8.13.0";

const { Pool } = pg;
const POOL = new Pool({ connectionString: Deno.env.get("SUPABASE_DB_URL"), max: 1 });

// ── Types ──

interface DbMatch {
  id: string;
  league_id: number;
  season: number | null;
  round: string | null;
  home_team_id: number;
  away_team_id: number;
  date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  is_knockout: boolean;
}

// ── Helpers ──

async function buildIdMaps() {
  const client = await POOL.connect();
  try {
    const [leagues, teams] = await Promise.all([
      client.query("SELECT id, api_id FROM leagues"),
      client.query("SELECT id, api_id FROM teams"),
    ]);
    return {
      // Map by internal league ID (id) instead of api_id
      // leagueMap[id] → id (identity — matches are now returned with internal IDs)
      leagues: Object.fromEntries(leagues.rows.map((r: any) => [r.id, r.id])),
      teams: Object.fromEntries(teams.rows.map((r: any) => [r.api_id, r.id])),
    };
  } finally {
    client.release();
  }
}

// ── Public Functions ──

export async function upsertMatches(_supabaseClient: any, matches: any[]): Promise<number> {
  if (!matches || matches.length === 0) return 0;

  let { leagues: leagueMap, teams: teamMap } = await buildIdMaps();
  const client = await POOL.connect();

  try {
    // ── Auto-create unknown teams ───────────────────────────────────────────
    const seen = new Set<number>();
    for (const m of matches) {
      for (const side of ["home", "away"] as const) {
        const t = m.teams?.[side];
        if (t?.id && !teamMap[t.id] && !seen.has(t.id)) {
          const { rows } = await client.query(
            `INSERT INTO teams (api_id, name, logo) VALUES ($1,$2,$3)
             ON CONFLICT (api_id) DO UPDATE SET name=EXCLUDED.name, logo=EXCLUDED.logo
             RETURNING id`,
            [t.id, t.name, t.badge],
          );
          teamMap[t.id] = rows[0].id;
          seen.add(t.id);
        }
      }
    }

    // ── Upsert matches ──────────────────────────────────────────────────────
    let count = 0;
    for (const m of matches) {
      const leagueId = leagueMap[m.leagueId];
      const homeTeamId = m.teams?.home?.id ? teamMap[m.teams.home.id] : undefined;
      const awayTeamId = m.teams?.away?.id ? teamMap[m.teams.away.id] : undefined;

      if (!leagueId || !homeTeamId || !awayTeamId) continue;

      const status = m.status === "pending" ? "scheduled" : m.status;

      await client.query(
        `INSERT INTO matches (id, league_id, season, round, home_team_id, away_team_id, date, status, home_score, away_score, minute, is_knockout)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status, home_score = EXCLUDED.home_score,
           away_score = EXCLUDED.away_score, minute = EXCLUDED.minute,
           updated_at = now()`,
        [m.id, leagueId, m.season, m.round, homeTeamId, awayTeamId,
         new Date(m.date).toISOString(), status,
         m.score?.home ?? null, m.score?.away ?? null,
         m.minute ?? null, m.isKnockout ?? false],
      );
      count++;
    }
    return count;
  } finally {
    client.release();
  }
}

export async function upsertStandings(
  _supabaseClient: any,
  leagueApiId: number,
  season: number,
  standings: any[],
  directTeamIds = false,
): Promise<number> {
  if (!standings || standings.length === 0) return 0;

  let { leagues: leagueMap, teams: teamMap } = await buildIdMaps();
  const internalLeagueId = leagueMap[leagueApiId];
  if (!internalLeagueId) return 0;

  const client = await POOL.connect();
  try {
    // ── When teamIds are already DB internal IDs, use them directly ──────────
    if (directTeamIds) {
      let count = 0;
      for (const group of standings) {
        if (!group.teams) continue;
        for (const t of group.teams) {
          if (!t.teamId) continue;
          await client.query(
            `INSERT INTO standings (league_id, season, group_name, team_id, rank, points, played, wins, draws, losses, goals_for, goals_against, goal_diff)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (league_id, season, group_name, team_id) DO UPDATE SET
               rank = EXCLUDED.rank, points = EXCLUDED.points,
               played = EXCLUDED.played, wins = EXCLUDED.wins,
               draws = EXCLUDED.draws, losses = EXCLUDED.losses,
               goals_for = EXCLUDED.goals_for, goals_against = EXCLUDED.goals_against,
               goal_diff = EXCLUDED.goal_diff, updated_at = now()`,
            [internalLeagueId, season, group.group, t.teamId,
             t.rank, t.points ?? 0, t.played ?? 0, t.wins ?? 0,
             t.draws ?? 0, t.losses ?? 0, t.goalsFor ?? 0,
             t.goalsAgainst ?? 0, t.goalDiff ?? 0],
          );
          count++;
        }
      }
      return count;
    }

    // ── When teamIds are API IDs, convert via teamMap ────────────────────────
    const seen = new Set<number>();
    for (const group of standings) {
      if (!group.teams) continue;
      for (const t of group.teams) {
        if (t.teamId && !teamMap[t.teamId] && !seen.has(t.teamId)) {
          const { rows } = await client.query(
            `INSERT INTO teams (api_id, name, logo) VALUES ($1,$2,$3)
             ON CONFLICT (api_id) DO UPDATE SET name=EXCLUDED.name, logo=EXCLUDED.logo
             RETURNING id`,
            [t.teamId, t.name, t.logo],
          );
          teamMap[t.teamId] = rows[0].id;
          seen.add(t.teamId);
        }
      }
    }

    let count = 0;
    for (const group of standings) {
      if (!group.teams) continue;
      for (const t of group.teams) {
        const teamId = teamMap[t.teamId];
        if (!teamId) continue;

        await client.query(
          `INSERT INTO standings (league_id, season, group_name, team_id, rank, points, played, wins, draws, losses, goals_for, goals_against, goal_diff)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (league_id, season, group_name, team_id) DO UPDATE SET
             rank = EXCLUDED.rank, points = EXCLUDED.points,
             played = EXCLUDED.played, wins = EXCLUDED.wins,
             draws = EXCLUDED.draws, losses = EXCLUDED.losses,
             goals_for = EXCLUDED.goals_for, goals_against = EXCLUDED.goals_against,
             goal_diff = EXCLUDED.goal_diff, updated_at = now()`,
          [internalLeagueId, season, group.group, teamId,
           t.rank, t.points ?? 0, t.played ?? 0, t.wins ?? 0,
           t.draws ?? 0, t.losses ?? 0, t.goalsFor ?? 0,
           t.goalsAgainst ?? 0, t.goalDiff ?? 0],
        );
        count++;
      }
    }
    return count;
  } finally {
    client.release();
  }
}

export async function updatePipelineMeta(
  _supabaseClient: any,
  data: {
    last_fetched?: string;
    next_planned?: string;
    mode?: string;
    error_count?: number;
    last_error?: string | null;
    api_budget?: number;
    api_requests_today?: number;
    api_reset_date?: string;
    fast_mode?: boolean;
  },
): Promise<void> {
  const client = await POOL.connect();
  try {
    const sets: string[] = ["updated_at = now()"];
    const vals: any[] = [];
    let i = 1;

    if (data.last_fetched !== undefined) { sets.push(`last_fetched = $${i++}`); vals.push(data.last_fetched); }
    if (data.next_planned !== undefined) { sets.push(`next_planned = $${i++}`); vals.push(data.next_planned); }
    if (data.mode !== undefined) { sets.push(`mode = $${i++}`); vals.push(data.mode); }
    if (data.error_count !== undefined) { sets.push(`error_count = $${i++}`); vals.push(data.error_count); }
    if (data.last_error !== undefined) { sets.push(`last_error = $${i++}`); vals.push(data.last_error); }
    if (data.api_budget !== undefined) { sets.push(`api_budget = $${i++}`); vals.push(data.api_budget); }
    if (data.api_requests_today !== undefined) { sets.push(`api_requests_today = $${i++}`); vals.push(data.api_requests_today); }
    if (data.api_reset_date !== undefined) { sets.push(`api_reset_date = $${i++}`); vals.push(data.api_reset_date); }
    if (data.fast_mode !== undefined) { sets.push(`fast_mode = $${i++}`); vals.push(data.fast_mode); }

    await client.query(
      `UPDATE pipeline_meta SET ${sets.join(", ")} WHERE id = 1`,
      vals,
    );
  } finally {
    client.release();
  }
}

export async function readBudget(client: any): Promise<{
  api_budget: number;
  api_requests_today: number;
  api_reset_date: string | null;
}> {
  const { rows } = await client.query(
    "SELECT api_budget, api_requests_today, api_reset_date FROM pipeline_meta WHERE id = 1"
  );
  return rows[0] || { api_budget: 100, api_requests_today: 0, api_reset_date: null };
}
