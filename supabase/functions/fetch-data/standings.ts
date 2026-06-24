// standings.ts — Compute World Cup group standings from match results
//
// Orchestration layer. Pure computation logic is in standings-core.ts.
// Strategy:
//   1. Query standings table for team→group mapping (cached from previous runs)
//   2. If empty (fresh DB), fetch from API once to bootstrap
//   3. Query matches table for all finished/live group stage matches
//   4. Compute Pts/PJ/G/E/P/GF/GC/DG per team (delegated to standings-core.ts)
//   5. Apply FIFA tiebreakers: Pts → GD → GF → H2H points → H2H GD → H2H GF
//   6. Upsert into standings table

import pg from "npm:pg@8.13.0";
import { getStandings, type StandingsGroup } from "./api.ts";
import { type TeamGroupMap, type RawMatch, aggregateStats, statsToStandings } from "./standings-core.ts";

// ── Team lookup helper ──────────────────────────────────────────────────────

async function getInternalLeagueId(pool: pg.Pool): Promise<number | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id FROM leagues WHERE api_id = 1 LIMIT 1",
    );
    return rows.length > 0 ? rows[0].id : null;
  } finally {
    client.release();
  }
}

// ── Group mapping ────────────────────────────────────────────────────────────

/**
 * Extract team→group mapping from the standings table (already populated).
 * Returns null if table is empty (needs bootstrap).
 */
export async function getGroupTeamMap(
  pool: pg.Pool,
  leagueId: number,
  season: number = 2026,
): Promise<TeamGroupMap | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT DISTINCT s.team_id, s.group_name
       FROM standings s
       WHERE s.league_id = $1 AND s.season = $2
       ORDER BY s.team_id`,
      [leagueId, season],
    );

    if (rows.length === 0) return null;

    const map: TeamGroupMap = {};
    for (const row of rows) {
      map[Number(row.team_id)] = String(row.group_name);
    }
    return map;
  } finally {
    client.release();
  }
}

/**
 * Bootstrap group mapping from API standings (fallback for fresh DB).
 * Returns the mapping and also saves it via upsertStandings.
 */
export async function bootstrapGroupMap(
  pool: pg.Pool,
  leagueId: number,
): Promise<TeamGroupMap | null> {
  try {
    const apiStandings = await getStandings(1, 2026);
    if (apiStandings.length === 0) return null;

    const client = await pool.connect();
    try {
      const { rows: teamRows } = await client.query(
        "SELECT id, api_id FROM teams",
      );
      const apiToDb: Record<number, number> = {};
      for (const r of teamRows) {
        apiToDb[Number(r.api_id)] = Number(r.id);
      }

      const map: TeamGroupMap = {};
      for (const group of apiStandings) {
        for (const t of group.teams) {
          const dbId = apiToDb[t.teamId];
          if (dbId) map[dbId] = group.group;
        }
      }

      return Object.keys(map).length > 0 ? map : null;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn("[standings] Bootstrap failed:", (err as Error).message);
    return null;
  }
}

// ── Match loader ──────────────────────────────────────────────────────────

async function loadGroupMatches(
  pool: pg.Pool,
  leagueId: number,
  season: number,
): Promise<RawMatch[]> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, home_team_id, away_team_id, home_score, away_score,
              status, date, round
       FROM matches
       WHERE league_id = $1
         AND season = $2
         AND status IN ('finished', 'live')
         AND is_knockout = false
       ORDER BY date`,
      [leagueId, season],
    );
    return rows;
  } finally {
    client.release();
  }
}

// ── Name resolution ─────────────────────────────────────────────────────────

async function resolveTeamNames(
  pool: pg.Pool,
  standings: StandingsGroup[],
): Promise<void> {
  const ids = new Set<number>();
  for (const g of standings) {
    for (const t of g.teams) ids.add(t.teamId);
  }
  if (ids.size === 0) return;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, name, logo FROM teams WHERE id = ANY($1)",
      [[...ids]],
    );
    const nameMap: Record<number, { name: string; logo: string }> = {};
    for (const r of rows) {
      nameMap[Number(r.id)] = { name: r.name, logo: r.logo || "" };
    }
    for (const g of standings) {
      for (const t of g.teams) {
        const info = nameMap[t.teamId];
        if (info) { t.name = info.name; t.logo = info.logo; }
      }
    }
  } finally {
    client.release();
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Main entry point: compute World Cup group standings from match results.
 *
 * Priority:
 *   1. If standings table has team→group mapping → compute from matches
 *   2. If no mapping (fresh DB) → bootstrap from API once
 *   3. If bootstrap fails → return []
 */
export async function computeStandings(
  pool: pg.Pool,
): Promise<StandingsGroup[]> {
  const leagueId = await getInternalLeagueId(pool);
  if (!leagueId) {
    console.warn("[standings] World Cup league not found in DB");
    return [];
  }

  let groupMap = await getGroupTeamMap(pool, leagueId);

  if (!groupMap) {
    console.log("[standings] No cached group map — bootstrapping from API");
    groupMap = await bootstrapGroupMap(pool, leagueId);
    if (!groupMap) {
      console.warn("[standings] Bootstrap failed, no standings available");
      return [];
    }
  }

  const matches = await loadGroupMatches(pool, leagueId, 2026);
  if (matches.length === 0) {
    console.log("[standings] No group matches found (tournament might not have started)");
    return [];
  }

  const stats = aggregateStats(matches, groupMap);
  const standings = statsToStandings(stats, groupMap, matches);
  await resolveTeamNames(pool, standings);

  return standings;
}
