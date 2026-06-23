// supabaseAdapter — Frontend query layer for Supabase consumption
//
// Queries matches, standings, and bracket_nodes via the Supabase client
// (anon key + RLS). Returns the same normalized shapes as apiFootball.js
// so that hooks and components are agnostic to the data source.
//
// Schema reference: supabase/migrations/001_schema.sql
// Spec: openspec/specs/supabase-consumption/spec.md

import { supabase } from '../lib/supabase.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a DB match row (with JOINed league + teams) to the Match[] shape
 * consumed by hooks/components.
 *
 * Expected input shape (from Supabase query with joins):
 * {
 *   id, league_id, season, round,
 *   date, status, home_score, away_score, minute, elapsed,
 *   is_knockout, venue,
 *   league:        { id, name, logo, api_id },
 *   home_team:     { id, name, logo, api_id },
 *   away_team:     { id, name, logo, api_id },
 * }
 *
 * @param {Object} row - Raw DB row from Supabase
 * @returns {Object} Normalized Match
 */
function normalizeMatch(row) {
  return {
    id: row.id,
    title: `${row.home_team?.name || 'N/A'} vs ${row.away_team?.name || 'N/A'}`,
    date: new Date(row.date).getTime(),
    league: row.league?.name || 'Otros',
    leagueId: row.league_id,
    competitionCode: null,
    stage: null,
    teams: {
      home: {
        name: row.home_team?.name || 'N/A',
        badge: row.home_team?.logo || '',
        id: row.home_team?.api_id || row.home_team_id,
      },
      away: {
        name: row.away_team?.name || 'N/A',
        badge: row.away_team?.logo || '',
        id: row.away_team?.api_id || row.away_team_id,
      },
    },
    status: row.status || 'pending',
    score: {
      home: row.home_score ?? null,
      away: row.away_score ?? null,
    },
    minute: row.minute ?? row.elapsed ?? null,
    round: row.round || null,
    matchday: null,
    isKnockout: row.is_knockout || false,
    season: row.season || null,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all matches for a specific LOCAL date.
 *
 * Queries the UTC date range that covers the local day (same strategy as
 * apiFootball.js), then filters by local date client-side for timezone safety.
 *
 * @param {Date|string} date - Local date to query
 * @returns {Promise<Object[]>} Normalized Match array
 */
export async function getMatches(date) {
  const targetDate = new Date(date);

  // Calculate UTC range covering this local day
  const localMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  );
  const nextMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate() + 1
  );

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      league:league_id (id, name, logo, api_id),
      home_team:home_team_id (id, name, logo, api_id),
      away_team:away_team_id (id, name, logo, api_id)
    `)
    .gte('date', localMidnight.toISOString())
    .lt('date', nextMidnight.toISOString())
    .order('date');

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Filter by LOCAL date (matches apiFootball.js behavior)
  return (data || [])
    .filter((m) => {
      const matchDate = new Date(m.date);
      return (
        matchDate.getFullYear() === targetDate.getFullYear() &&
        matchDate.getMonth() === targetDate.getMonth() &&
        matchDate.getDate() === targetDate.getDate()
      );
    })
    .map(normalizeMatch);
}

/**
 * Get all currently live matches.
 *
 * @returns {Promise<Object[]>} Normalized Match array (live only)
 */
export async function getLiveMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      league:league_id (id, name, logo, api_id),
      home_team:home_team_id (id, name, logo, api_id),
      away_team:away_team_id (id, name, logo, api_id)
    `)
    .eq('status', 'live')
    .order('date');

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return (data || []).map(normalizeMatch);
}

/**
 * Get standings for a league and season.
 *
 * Queries the standings table with a JOIN to teams, groups by group_name,
 * and returns the same shape as apiFootball.js normalizeStandings().
 *
 * @param {number} leagueId - League ID (matches leagues.api_id)
 * @param {number} season - Season year (e.g. 2026)
 * @returns {Promise<Array<{group: string, teams: Array}>>}
 */
export async function getStandings(leagueId, season) {
  const { data, error } = await supabase
    .from('standings')
    .select(`
      *,
      team:team_id (id, name, logo, api_id),
      league:league_id!inner (api_id)
    `)
    .eq('league.api_id', leagueId)
    .eq('season', season)
    .order('group_name')
    .order('rank');

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Group by group_name
  const groups = {};
  for (const row of data || []) {
    if (!groups[row.group_name]) {
      groups[row.group_name] = [];
    }
    groups[row.group_name].push({
      rank: row.rank,
      name: row.team?.name || 'N/A',
      logo: row.team?.logo || '',
      teamId: row.team?.api_id || row.team_id,
      points: row.points,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      goalDiff: row.goal_diff,
    });
  }

  // Convert to array format matching apiFootball.js output
  return Object.entries(groups).map(([groupName, teams]) => ({
    group: groupName,
    teams,
  }));
}

/**
 * Get all bracket nodes for the World Cup knockout bracket.
 *
 * @returns {Promise<Object[]>} Bracket nodes ordered by round_index, matchup_index
 */
export async function getBracketNodes() {
  const { data, error } = await supabase
    .from('bracket_nodes')
    .select('*')
    .order('round_index')
    .order('matchup_index');

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return data || [];
}

export const supabaseAdapter = {
  getMatches,
  getLiveMatches,
  getStandings,
  getBracketNodes,
};
