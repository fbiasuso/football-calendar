// standings-core.ts — Pure computation logic for World Cup group standings
//
// No DB dependencies. All functions are pure and testable without a database.
// Imported by standings.ts (orchestration layer) and test files.

import { type StandingsGroup } from "./api.ts";

// ── Types ────────────────────────────────────────────────────────────────────

export type TeamGroupMap = Record<number, string>; // internal team_id → group letter

export interface RawMatch {
  id: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number | null;
  away_score: number | null;
  status: string;
  date: string;
  round: string | null;
}

export interface TeamStats {
  teamId: number;
  group: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

// ── Match grouping ───────────────────────────────────────────────────────────

/**
 * Determine if a match is a group stage match by checking if both teams
 * are in the same group according to the mapping.
 */
export function getMatchGroup(
  match: RawMatch,
  groupMap: TeamGroupMap,
): string | null {
  const g1 = groupMap[match.home_team_id];
  const g2 = groupMap[match.away_team_id];
  if (!g1 || !g2) return null;
  if (g1 !== g2) return null; // inter-group or knockout — skip
  return g1;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Compute per-team stats from raw matches.
 */
export function aggregateStats(
  matches: RawMatch[],
  groupMap: TeamGroupMap,
): Map<number, TeamStats> {
  const stats = new Map<number, TeamStats>();

  function ensure(teamId: number, group: string): TeamStats {
    let s = stats.get(teamId);
    if (!s) {
      s = { teamId, group, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
      stats.set(teamId, s);
    }
    return s;
  }

  for (const m of matches) {
    const group = getMatchGroup(m, groupMap);
    if (!group) continue;

    const homeScore = m.home_score ?? 0;
    const awayScore = m.away_score ?? 0;

    const home = ensure(m.home_team_id, group);
    const away = ensure(m.away_team_id, group);

    if (m.home_score !== null && m.away_score !== null) {
      home.played++;
      away.played++;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) { home.wins++; away.losses++; }
      else if (homeScore < awayScore) { home.losses++; away.wins++; }
      else { home.draws++; away.draws++; }
    }
  }

  return stats;
}

// ── Standings conversion ─────────────────────────────────────────────────────

/**
 * Convert stats to common format and sort by FIFA rules.
 */
export function statsToStandings(
  stats: Map<number, TeamStats>,
  groupMap: TeamGroupMap,
  allMatches: RawMatch[],
): StandingsGroup[] {
  const groups = new Map<string, TeamStats[]>();
  for (const s of stats.values()) {
    const list = groups.get(s.group) || [];
    list.push(s);
    groups.set(s.group, list);
  }

  const h2hCache = buildH2HCache(allMatches);
  const result: StandingsGroup[] = [];

  for (const group of [...groups.keys()].sort()) {
    const teams = groups.get(group)!;
    teams.sort((a, b) => compareTeams(a, b, h2hCache));

    const standings = teams.map((s, idx) => ({
      rank: idx + 1,
      name: "",
      logo: "",
      teamId: s.teamId,
      points: s.wins * 3 + s.draws,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDiff: s.goalsFor - s.goalsAgainst,
    }));

    result.push({ group, teams: standings });
  }

  return result;
}

// ── Tiebreakers ──────────────────────────────────────────────────────────────

/**
 * Build a cache of H2H stats for every pair of teams that have played.
 */
export function buildH2HCache(
  matches: RawMatch[],
): Map<string, { aPts: number; aGD: number; aGF: number; bPts: number; bGD: number; bGF: number }> {
  const cache = new Map<string, any>();

  for (const m of matches) {
    if (m.home_score === null || m.away_score === null) continue;

    const key = `${Math.min(m.home_team_id, m.away_team_id)}-${Math.max(m.home_team_id, m.away_team_id)}`;
    const existing = cache.get(key) || { aPts: 0, aGD: 0, aGF: 0, bPts: 0, bGD: 0, bGF: 0 };

    const isNaturalOrder = m.home_team_id < m.away_team_id;
    const aScore = isNaturalOrder ? m.home_score! : m.away_score!;
    const bScore = isNaturalOrder ? m.away_score! : m.home_score!;

    if (aScore > bScore) existing.aPts += 3;
    else if (aScore < bScore) existing.bPts += 3;
    else { existing.aPts += 1; existing.bPts += 1; }

    existing.aGD += aScore - bScore;
    existing.bGD += bScore - aScore;
    existing.aGF += aScore;
    existing.bGF += bScore;

    cache.set(key, existing);
  }

  return cache;
}

/**
 * Get H2H stats between two teams.
 */
export function getH2H(
  h2hCache: Map<string, any>,
  id1: number,
  id2: number,
): { ptsA: number; ptsB: number; gdA: number; gdB: number; gfA: number; gfB: number } {
  const key = `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;
  const h = h2hCache.get(key);
  if (!h) return { ptsA: 0, ptsB: 0, gdA: 0, gdB: 0, gfA: 0, gfB: 0 };

  const isNaturalOrder = id1 < id2;
  return {
    ptsA: isNaturalOrder ? h.aPts : h.bPts,
    ptsB: isNaturalOrder ? h.bPts : h.aPts,
    gdA: isNaturalOrder ? h.aGD : h.bGD,
    gdB: isNaturalOrder ? h.bGD : h.aGD,
    gfA: isNaturalOrder ? h.aGF : h.bGF,
    gfB: isNaturalOrder ? h.bGF : h.aGF,
  };
}

/**
 * Compare two teams using FIFA World Cup tiebreaker rules:
 * Pts → GD → GF → H2H points → H2H GD → H2H GF
 */
export function compareTeams(
  a: TeamStats,
  b: TeamStats,
  h2hCache: Map<string, any>,
): number {
  const ptsA = a.wins * 3 + a.draws;
  const ptsB = b.wins * 3 + b.draws;
  const gdA = a.goalsFor - a.goalsAgainst;
  const gdB = b.goalsFor - b.goalsAgainst;

  if (ptsA !== ptsB) return ptsB - ptsA;
  if (gdA !== gdB) return gdB - gdA;
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;

  const h2h = getH2H(h2hCache, a.teamId, b.teamId);
  if (h2h.ptsA !== h2h.ptsB) return h2h.ptsB - h2h.ptsA;
  if (h2h.gdA !== h2h.gdB) return h2h.gdB - h2h.gdA;
  if (h2h.gfA !== h2h.gfB) return h2h.gfB - h2h.gfA;

  return 0; // genuinely exceptional tie — keep current order
}
