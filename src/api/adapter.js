// API Adapter Interface for Football Calendar
// This interface abstracts the underlying API provider
// Currently using SportSRC, can be swapped to another provider

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
  const { sportsrcClient } = await import('./sportsrc.js');
  return sportsrcClient.getMatches(date);
}

/**
 * Get live matches for a specific date
 * @param {Date|string} date
 * @returns {Promise<Match[]>}
 */
export async function getLiveMatches(date) {
  const { sportsrcClient } = await import('./sportsrc.js');
  return sportsrcClient.getLiveMatches(date);
}

/**
 * Get available leagues
 * @returns {Promise<Array<{id: string, name: string}[]>}
 */
export async function getLeagues() {
  const { sportsrcClient } = await import('./sportsrc.js');
  return sportsrcClient.getLeagues();
}