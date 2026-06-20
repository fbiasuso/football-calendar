// API-Football v3 Client for Node.js
// Used by data pipeline scripts (not in browser)
// Adaptado de src/api/apiFootball.js — misma lógica, entorno Node.js

const API_BASE_URL = 'https://v3.football.api-sports.io';
const API_KEY = process.env.VITE_API_FOOTBALL_API_KEY || '';

// Inline league IDs (self-contained, no dependency on src/utils/leagueConfig.js)
const API_FOOTBALL_LEAGUE_IDS = {
  'World Cup 2026': 1,
  'UEFA Champions League': 2,
  'Copa Libertadores': 13,
  'Copa Sudamericana': 11,
  'Premier League': 39,
  'FA Cup': 45,
  'EFL Cup': 48,
  'LaLiga': 140,
  'Copa del Rey': 143,
  'Supercopa': 556,
  'Serie A': 135,
  'Coppa Italia': 137,
  'Bundesliga': 78,
  'DFB-Pokal': 81,
};

async function fetchWithRetry(endpoint, retries = 0) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return fetchWithRetry(endpoint, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // API-Football returns errors inside the response body even on HTTP 200
    if (data.errors && Object.keys(data.errors).length > 0) {
      const errorMsg = Object.values(data.errors).join(', ');
      throw new Error(`API-Football Error: ${errorMsg}`);
    }

    return data;
  } catch (error) {
    if (retries < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(endpoint, retries + 1);
    }
    throw error;
  }
}

/**
 * Map API-Football short status codes to internal status
 * @param {string} shortCode
 * @returns {'pending'|'live'|'finished'}
 */
function mapStatus(shortCode) {
  const statusMap = {
    'NS': 'pending',
    'TBD': 'pending',
    'PST': 'pending',
    'INT': 'pending',
    'SUSP': 'live',
    '1H': 'live',
    'HT': 'live',
    '2H': 'live',
    'ET': 'live',
    'BT': 'live',
    'P': 'live',
    'LIVE': 'live',
    'FT': 'finished',
    'AET': 'finished',
    'PEN': 'finished',
    'CANC': 'finished',
    'ABD': 'finished',
    'AWD': 'finished',
    'WO': 'finished',
  };
  return statusMap[shortCode] || 'pending';
}

/**
 * Detect if a round string indicates a knockout round
 * @param {string|null} round
 * @returns {boolean}
 */
function isKnockoutRound(round) {
  if (!round) return false;
  return /Round of 16|Quarter|Semi|Final/i.test(round);
}

/**
 * Normalize an API-Football fixture to the agnostic Match interface
 * @param {Object} fixture - Raw fixture from API-Football
 * @returns {Object} Normalized Match
 */
function normalizeMatch(fixture) {
  const f = fixture.fixture || {};
  const league = fixture.league || {};
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const homeTeam = teams.home || {};
  const awayTeam = teams.away || {};
  const status = f.status || {};

  // Map API-Football league ID back to our display name
  const leagueName = Object.keys(API_FOOTBALL_LEAGUE_IDS).find(
    key => API_FOOTBALL_LEAGUE_IDS[key] === league.id
  ) || 'Otros';

  return {
    id: String(f.id),
    title: `${homeTeam.name || 'N/A'} vs ${awayTeam.name || 'N/A'}`,
    date: new Date(f.date || f.timestamp * 1000).getTime(),
    league: leagueName,
    leagueId: league.id,
    competitionCode: null,
    stage: null,
    teams: {
      home: {
        name: homeTeam.name || 'N/A',
        badge: homeTeam.logo || '',
        id: homeTeam.id,
      },
      away: {
        name: awayTeam.name || 'N/A',
        badge: awayTeam.logo || '',
        id: awayTeam.id,
      },
    },
    status: mapStatus(status.short),
    score: {
      home: goals.home ?? null,
      away: goals.away ?? null,
    },
    minute: status.elapsed || null,
    round: league.round || null,
    matchday: null,
    isKnockout: isKnockoutRound(league.round),
    season: league.season || null,
  };
}

/**
 * Get the list of supported API-Football league IDs
 * @returns {number[]}
 */
function getSupportedLeagueIds() {
  return Object.values(API_FOOTBALL_LEAGUE_IDS);
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date as YYYY-MM-DD using UTC methods
 */
function formatUtcDate(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalize standings response to per-group structure
 * @param {Object} data - Raw API response
 * @returns {Array<{group: string, teams: Array}>}
 */
function normalizeStandings(data) {
  const response = data?.response || [];
  if (response.length === 0) return [];

  const leagueData = response[0];
  if (!leagueData) return [];

  // Handle both: leagueData.standings (new) and leagueData.league.standings (nested)
  const rawStandings = leagueData.standings || leagueData.league?.standings || [];

  // Flatten in case the API wraps each group in an extra array level
  const groups = Array.isArray(rawStandings) ? rawStandings : [];

  // World Cup: the API returns 13 entries (12 groups A-L + 1 combined third-place ranking)
  // We only want the first 12 groups (A-L), skip the combined ranking
  const groupCount = Math.min(groups.length, 12);

  return groups.slice(0, groupCount).map((groupStandings, index) => {
    const group = String.fromCharCode(65 + index); // 65 = 'A'

    // groupStandings might be an array of team entries
    const teams = Array.isArray(groupStandings) ? groupStandings : [];

    return {
      group,
      teams: teams.map((entry) => ({
        rank: entry?.rank,
        name: entry?.team?.name || entry?.name || 'N/A',
        logo: entry?.team?.logo || entry?.logo || '',
        teamId: entry?.team?.id || entry?.id,
        points: entry?.points ?? 0,
        played: entry?.all?.played ?? 0,
        wins: entry?.all?.win ?? 0,
        draws: entry?.all?.draw ?? 0,
        losses: entry?.all?.lose ?? 0,
        goalsFor: entry?.all?.goals?.for ?? 0,
        goalsAgainst: entry?.all?.goals?.against ?? 0,
        goalDiff: (entry?.all?.goals?.for ?? 0) - (entry?.all?.goals?.against ?? 0),
      })),
    };
  });
}

/**
 * Get all matches for a specific LOCAL date.
 * Queries the 2 UTC dates that could contain matches for this local day,
 * then filters results by LOCAL date to handle any timezone offset.
 * @param {Date|string} date - Local date to query
 * @returns {Promise<Object[]>}
 */
export async function getMatches(date) {
  const targetDate = new Date(date);

  // Calculate the UTC date range that covers this local day
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

  const utcDates = [...new Set([
    formatUtcDate(localMidnight),
    formatUtcDate(nextMidnight),
  ])];

  // Query both UTC dates in parallel
  const [data1, data2] = await Promise.all([
    fetchWithRetry(`/fixtures?date=${utcDates[0]}`),
    utcDates[1] ? fetchWithRetry(`/fixtures?date=${utcDates[1]}`) : Promise.resolve({ response: [] }),
  ]);

  const allFixtures = [...(data1.response || []), ...(data2.response || [])];
  const supportedIds = getSupportedLeagueIds();

  return allFixtures
    .filter(f => supportedIds.includes(f.league?.id))
    .filter(f => {
      // Convert match UTC time to local time and compare with target date
      const matchDate = new Date(f.fixture?.date || f.timestamp * 1000);
      return matchDate.getFullYear() === targetDate.getFullYear() &&
             matchDate.getMonth() === targetDate.getMonth() &&
             matchDate.getDate() === targetDate.getDate();
    })
    .map(normalizeMatch);
}

/**
 * Get all currently live matches
 * @returns {Promise<Object[]>}
 */
export async function getLiveMatches() {
  const data = await fetchWithRetry('/fixtures?live=all');
  const supportedIds = getSupportedLeagueIds();

  return (data.response || [])
    .filter(f => supportedIds.includes(f.league?.id))
    .map(normalizeMatch);
}

/**
 * Get standings for a league and season
 * @param {number} leagueId - API-Football league ID (e.g. 1 for World Cup)
 * @param {number} season - Season year (e.g. 2026)
 * @returns {Promise<Array<{group: string, teams: Array}>>}
 */
export async function getStandings(leagueId, season) {
  const data = await fetchWithRetry(`/standings?league=${leagueId}&season=${season}`);
  return normalizeStandings(data);
}

/**
 * Get fixture rounds for a league and season
 * @param {number} leagueId - API-Football league ID
 * @param {number} season - Season year
 * @returns {Promise<string[]>}
 */
export async function getRounds(leagueId, season) {
  const data = await fetchWithRetry(`/fixtures/rounds?league=${leagueId}&season=${season}`);
  return data.response || [];
}

/**
 * Get a single match by ID (returns normalized Match)
 * @param {string} matchId
 * @returns {Promise<Object>}
 */
export async function getMatchById(matchId) {
  const data = await fetchWithRetry(`/fixtures?id=${matchId}`);
  const fixtures = data.response || [];

  if (fixtures.length === 0) {
    throw new Error(`Match ${matchId} not found`);
  }

  return normalizeMatch(fixtures[0]);
}

// Exports for use by other scripts
export {
  fetchWithRetry,
  mapStatus,
  isKnockoutRound,
  normalizeMatch,
  getSupportedLeagueIds,
  formatDate,
  formatUtcDate,
  normalizeStandings,
};
