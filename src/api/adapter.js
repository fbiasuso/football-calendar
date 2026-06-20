// API Adapter Interface for Football Calendar
// Using API-Football (api-sports.io v3)
// Soporta modo estático (lee de /data/*.json) con fallback a API real
// Auto-detección: al primer llamado, intenta fetch('/data/meta.json')
// Si existe → modo estático para toda la sesión
// Si no → fallback a API real (dev, o gh-pages no deployado)

import { getDateKey } from '../utils/dateUtils.js';

const STATIC_BASE = '/data';
let staticMode = null; // null=unsure, true=static, false=live (cached after first check)

/**
 * Try to fetch a static JSON file from /data/
 * @param {string} path - Path relative to /data/ (e.g. 'matches-2026-06-20.json')
 * @returns {Promise<any|null>} Parsed JSON or null if not available
 */
async function tryFetchStatic(path) {
  try {
    const res = await fetch(`${STATIC_BASE}/${path}`);
    if (res.ok) return res.json();
  } catch {
    // Network error — silent fail, will fall back to API
  }
  return null;
}

/**
 * Detect whether we should use static data or live API.
 * Uses VITE_DATA_SOURCE env var if set, otherwise auto-detects
 * by trying to fetch /data/meta.json.
 * @returns {Promise<boolean>} true = static mode
 */
async function detectStaticMode() {
  if (import.meta.env.VITE_DATA_SOURCE === 'static') return true;
  if (import.meta.env.VITE_DATA_SOURCE === 'live') return false;

  const meta = await tryFetchStatic('meta.json');
  return meta !== null;
}

/**
 * Ensure static mode has been detected
 */
async function ensureModeDetected() {
  if (staticMode === null) {
    staticMode = await detectStaticMode();
  }
  return staticMode;
}

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} title
 * @property {number} date          - Unix timestamp ms
 * @property {string} league        - Display name (e.g. "Premier League")
 * @property {number} leagueId      - API-Football league ID
 * @property {Object} teams
 * @property {Object} teams.home
 * @property {string} teams.home.name
 * @property {string} teams.home.badge
 * @property {number} teams.home.id
 * @property {Object} teams.away
 * @property {string} teams.away.name
 * @property {string} teams.away.badge
 * @property {number} teams.away.id
 * @property {'pending'|'live'|'finished'} status
 * @property {Object} score
 * @property {number|null} score.home
 * @property {number|null} score.away
 * @property {number|null} minute
 * @property {string|null} round     - e.g. "Regular Season - 28", "Round of 16"
 * @property {boolean} isKnockout    - true when round contains knockout keywords
 * @property {number|null} season    - e.g. 2024
 */

/**
 * Get all matches for a specific date
 * @param {Date|string} date
 * @returns {Promise<Match[]>}
 */
export async function getMatches(date) {
  const isStatic = await ensureModeDetected();

  if (isStatic) {
    const dateKey = getDateKey(date);
    const data = await tryFetchStatic(`matches-${dateKey}.json`);
    if (data) return data;
    // Fall through to API fallback
  }

  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getMatches(date);
}

/**
 * Get live matches
 * @returns {Promise<Match[]>}
 */
export async function getLiveMatches() {
  const isStatic = await ensureModeDetected();

  if (isStatic) {
    const data = await tryFetchStatic('matches-live.json');
    if (data) return data;
  }

  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getLiveMatches();
}

/**
 * Get available leagues
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getLeagues() {
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getCompetitions();
}

/**
 * Get single match details (for aggregate score in knockout ties)
 * @param {string} matchId
 * @returns {Promise<Match>}
 */
export async function getMatchById(matchId) {
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getMatchById(matchId);
}

/**
 * Find first leg match for aggregate calculation
 * @param {Object} match - Match object with team IDs and date info
 * @returns {Promise<{home: number, away: number}|null>}
 */
export async function findFirstLegMatch(match) {
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.findFirstLegMatch(match);
}

/**
 * Get standings for a league and season
 * @param {number} leagueId - API-Football league ID
 * @param {number} season - Season year
 * @returns {Promise<Array<{group: string, teams: Array}>>}
 */
export async function getStandings(leagueId, season) {
  const isStatic = await ensureModeDetected();

  if (isStatic) {
    const data = await tryFetchStatic('standings.json');
    if (data) return data;
  }

  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getStandings(leagueId, season);
}

/**
 * Get fixture rounds for a league and season
 * @param {number} leagueId - API-Football league ID
 * @param {number} season - Season year
 * @returns {Promise<string[]>}
 */
export async function getRounds(leagueId, season) {
  const isStatic = await ensureModeDetected();

  if (isStatic) {
    // Rounds not typically stored as static file; if available, could be in schedule
    const data = await tryFetchStatic('schedule.json');
    // schedule.json doesn't contain rounds, so fall through
    if (data && data.rounds) return data.rounds;
  }

  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getRounds(leagueId, season);
}
