// API Provider — reads VITE_FOOTBALL_PROVIDER env var to switch between clients
// Default: football-data (football-data.org v4)

/**
 * @typedef {Object} FootballClient
 * @property {(date: Date|string) => Promise<Object[]>} getMatches
 * @property {() => Promise<Object[]>} getLiveMatches
 * @property {(matchId: string) => Promise<Object>} getMatchById
 * @property {(match: Object) => Promise<{home: number, away: number}|null>} findFirstLegMatch
 * @property {(leagueId: number, season: number) => Promise<Array<{group: string, teams: Array}>>} getStandings
 * @property {(leagueId: number, season: number) => Promise<string[]>} getRounds
 */

/**
 * Get the configured API client based on VITE_FOOTBALL_PROVIDER env var.
 * @returns {Promise<FootballClient>}
 */
export async function getClient() {
  const provider = import.meta.env.VITE_FOOTBALL_PROVIDER || 'football-data';

  switch (provider) {
    case 'football-data': {
      const { footballDataClient } = await import('./footballData.js');
      return footballDataClient;
    }
    case 'api-football': {
      const { apiFootballClient } = await import('./apiFootball.js');
      return apiFootballClient;
    }
    default:
      throw new Error(`Unknown football provider: "${provider}". Use "football-data" or "api-football".`);
  }
}
