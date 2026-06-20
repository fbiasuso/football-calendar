// API Adapter Interface for Football Calendar
// Using API-Football (api-sports.io v3)

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
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getMatches(date);
}

/**
 * Get live matches for a specific date
 * @param {Date|string} date
 * @returns {Promise<Match[]>}
 */
export async function getLiveMatches(date) {
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getLiveMatches(date);
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
  const { apiFootballClient } = await import('./apiFootball.js');
  return apiFootballClient.getRounds(leagueId, season);
}