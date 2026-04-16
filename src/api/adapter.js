// API Adapter Interface for Football Calendar
// Using football-data.org API (has scores!)

/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} title
 * @property {number} date - Unix timestamp
 * @property {string} league
 * @property {Object} teams
 * @property {Object} teams.home
 * @property {string} teams.home.name
 * @property {string} teams.home.badge
 * @property {Object} teams.away
 * @property {string} teams.away.name
 * @property {string} teams.away.badge
 * @property {string} status - 'pending' | 'live' | 'finished'
 * @property {Object} [score]
 * @property {number} [score.home]
 * @property {number} [score.away]
 * @property {number} [minute]
 */

/**
 * Get all matches for a specific date
 * @param {Date|string} date
 * @returns {Promise<Match[]>}
 */
export async function getMatches(date) {
  const { footballDataClient } = await import('./footballData.js');
  return footballDataClient.getMatches(date);
}

/**
 * Get live matches for a specific date
 * @param {Date|string} date
 * @returns {Promise<Match[]>}
 */
export async function getLiveMatches(date) {
  const { footballDataClient } = await import('./footballData.js');
  return footballDataClient.getLiveMatches(date);
}

/**
 * Get available leagues
 * @returns {Promise<Array<{id: string, name: string}[]>}
 */
export async function getLeagues() {
  const { footballDataClient } = await import('./footballData.js');
  return footballDataClient.getCompetitions();
}

/**
 * Get single match details (for aggregate score in knockout ties)
 * @param {string} matchId
 * @returns {Promise<Match>}
 */
export async function getMatchById(matchId) {
  const { footballDataClient } = await import('./footballData.js');
  return footballDataClient.getMatchById(matchId);
}