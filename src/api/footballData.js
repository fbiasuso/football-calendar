// Football-Data.org API Client
// Documentation: https://www.football-data.org/documentation
// Using Vite proxy to avoid CORS issues

const API_KEY = import.meta.env.VITE_FOOTBALL_DATA_API_KEY;
const PROXY_URL = '/api/football-data';

async function fetchWithRetry(endpoint, retries = 0) {
  const url = `${PROXY_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'X-Auth-Token': API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < 3) {
        // Rate limited - wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return fetchWithRetry(endpoint, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (retries < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(endpoint, retries + 1);
    }
    throw error;
  }
}

// Get matches for a date
// Fetches a wider range to handle timezone differences (South American matches)
export async function getMatches(date) {
  const targetDate = typeof date === 'string' ? new Date(date) : new Date(date);
  
  // Fetch from day before to day after to catch timezone edge cases
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const dateFrom = formatDate(prevDate);
  const dateTo = formatDate(nextDate);
  
  const data = await fetchWithRetry(`/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`);
  
  // Filter matches to only those on the target date
  const targetDateStart = new Date(targetDate);
  targetDateStart.setHours(0, 0, 0, 0);
  const targetDateEnd = new Date(targetDate);
  targetDateEnd.setHours(23, 59, 59, 999);
  
  return (data.matches || [])
    .map(normalizeMatch)
    .filter(match => {
      const matchDate = new Date(match.date);
      return matchDate >= targetDateStart && matchDate <= targetDateEnd;
    });
}

// Get live matches
export async function getLiveMatches() {
  const data = await fetchWithRetry('/matches?status=LIVE_IN_PLAY');
  return (data.matches || []).map(normalizeMatch);
}

// Get all available competitions
export async function getCompetitions() {
  const data = await fetchWithRetry('/competitions');
  return (data.competitions || []).map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    area: c.area?.name,
  }));
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Map API status to our status
function mapStatus(apiStatus) {
  const statusMap = {
    'SCHEDULED': 'pending',
    'TIMED': 'pending',
    'IN_PLAY': 'live',
    'PAUSED': 'live',
    'LIVE': 'live',
    'FINISHED': 'finished',
    'POSTPONED': 'pending',
    'SUSPENDED': 'live',
    'CANCELLED': 'finished',
  };
  return statusMap[apiStatus] || 'pending';
}

// Normalize match data from API to our format
function normalizeMatch(match) {
  const homeTeam = match.homeTeam || {};
  const awayTeam = match.awayTeam || {};
  const score = match.score?.fullTime || {};
  
  return {
    id: String(match.id),
    title: `${homeTeam.name} vs ${awayTeam.name}`,
    date: new Date(match.utcDate).getTime(),
    league: match.competition?.name || 'Otros',
    leagueId: match.competition?.id,
    teams: {
      home: {
        name: homeTeam.name || 'N/A',
        badge: homeTeam.crest || '',
      },
      away: {
        name: awayTeam.name || 'N/A',
        badge: awayTeam.crest || '',
      },
    },
    status: mapStatus(match.status),
    score: {
      home: score.home ?? null,
      away: score.away ?? null,
    },
    minute: match.matchMinutes || null,
  };
}

export const footballDataClient = {
  getMatches,
  getLiveMatches,
  getCompetitions,
};