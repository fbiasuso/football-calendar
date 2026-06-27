// Football Data API Client — football-data.org v4
// Documentation: https://www.football-data.org/documentation
// Using Vite proxy to avoid CORS issues

const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY;
const PROXY_URL = '/api/football-data';

// Map of internal league IDs → football-data.org v4 competition IDs
// Used when calling football-data.org endpoints directly (non-Supabase mode)
const INTERNAL_TO_EXTERNAL_ID = {
  1: 2000,  // World Cup
  2: 2001,  // UEFA Champions League
  3: 2021,  // Premier League
  4: 2014,  // LaLiga
  5: 2002,  // Bundesliga
  6: 2019,  // Serie A
  7: 2055,  // FA Cup
  8: 2079,  // Copa del Rey
  9: 2011,  // DFB-Pokal
  10: 2122, // Coppa Italia
  11: 2139, // EFL Cup
  12: 2152, // Copa Libertadores
  13: 2024, // Argentine Liga Profesional
};

// Invert for external→internal lookup
const EXTERNAL_TO_INTERNAL_ID = Object.fromEntries(
  Object.entries(INTERNAL_TO_EXTERNAL_ID).map(([k, v]) => [v, Number(k)])
);

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
  const data = await fetchWithRetry('/matches?status=LIVE');
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

// Get single match details (for aggregate score in knockout ties)
export async function getMatchById(matchId) {
  const data = await fetchWithRetry(`/matches/${matchId}`);
  // Return raw match data to get access to score.extraTime, score.penalties, etc.
  return {
    id: String(data.id),
    score: {
      home: data.score?.fullTime?.home ?? null,
      away: data.score?.fullTime?.away ?? null,
      extraTime: data.score?.extraTime || null,
      penalties: data.score?.penalties || null,
    },
    stage: data.stage || null,
    matchday: data.matchday || null,
    homeTeam: { id: data.homeTeam?.id },
    awayTeam: { id: data.awayTeam?.id },
    competition: { id: data.competition?.id },
    season: { id: data.season?.id },
    utcDate: data.utcDate,
  };
}

// Get first leg match for aggregate calculation
export async function findFirstLegMatch(match) {
  const matchDate = new Date(match.utcDate);
  const seasonId = match.season?.id;
  const competitionId = match.competition?.id;
  const homeTeamId = match.homeTeam?.id;
  const awayTeamId = match.awayTeam?.id;
  
  // Search for matches in the 15 days before this match
  const prevDate = new Date(matchDate);
  prevDate.setDate(prevDate.getDate() - 15);
  const dateStr = formatDate(prevDate);
  
  try {
    // Use competition-specific endpoint instead of generic matches
    // This is more reliable than the /matches endpoint
    const data = await fetchWithRetry(`/competitions/${competitionId}/matches?dateFrom=${dateStr}&dateTo=${formatDate(matchDate)}`);
    
    console.log('Found matches for first leg search:', data.matches?.length);
    
    // Find the first leg: same teams in same competition, earlier date
    const firstLeg = (data.matches || []).find(m => {
      console.log('Checking match:', m.id, m.competition?.id, competitionId, m.homeTeam?.name, 'vs', m.awayTeam?.name);
      if (String(m.id) === String(match.id)) return false;
      if (m.competition?.id !== competitionId) return false;
      if (seasonId && m.season?.id !== seasonId) return false;
      
      // Check if same teams (home/away can be swapped)
      const sameTeams = 
        (m.homeTeam?.id === homeTeamId && m.awayTeam?.id === awayTeamId) ||
        (m.homeTeam?.id === awayTeamId && m.awayTeam?.id === homeTeamId);
      
      return sameTeams;
    });
    
    if (firstLeg) {
      // Check if home/away is swapped between legs
      const isSameHome = firstLeg.homeTeam?.id === homeTeamId;
      
      return {
        home: isSameHome 
          ? (firstLeg.score?.fullTime?.home ?? 0) 
          : (firstLeg.score?.fullTime?.away ?? 0),
        away: isSameHome 
          ? (firstLeg.score?.fullTime?.away ?? 0) 
          : (firstLeg.score?.fullTime?.home ?? 0),
      };
    }
  } catch (error) {
    console.warn('Error finding first leg:', error);
  }
  
  return null;
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

// Get standings for a league and season (non-Supabase mode)
export async function getStandings(leagueId, season) {
  const externalId = INTERNAL_TO_EXTERNAL_ID[leagueId];
  if (!externalId) throw new Error(`No football-data.org mapping for internal league ID ${leagueId}`);

  const data = await fetchWithRetry(`/competitions/${externalId}/standings`);
  const standings = data.standings || [];

  return standings
    .filter(s => s.type === 'TOTAL')
    .map(s => ({
      group: (s.group || '').replace('GROUP_', ''),
      teams: (s.table || []).map(entry => ({
        rank: entry.position,
        name: entry.team?.name || 'N/A',
        logo: entry.team?.crest || '',
        teamId: entry.team?.id,
        points: entry.points ?? 0,
        played: entry.playedGames ?? 0,
        wins: entry.won ?? 0,
        draws: entry.draw ?? 0,
        losses: entry.lost ?? 0,
        goalsFor: entry.goalsFor ?? 0,
        goalsAgainst: entry.goalsAgainst ?? 0,
        goalDiff: entry.goalDifference ?? 0,
      })),
    }));
}

// Get fixture rounds for a league and season (non-Supabase mode)
export async function getRounds(leagueId, season) {
  const externalId = INTERNAL_TO_EXTERNAL_ID[leagueId];
  if (!externalId) return [];

  const data = await fetchWithRetry(`/competitions/${externalId}/matches?season=${season}&limit=1`);
  // football-data.org doesn't have a dedicated rounds endpoint,
  // but matchday info is embedded in each match. Return empty for now.
  return [];
}

// Normalize match data from API to our format
function normalizeMatch(match) {
  const homeTeam = match.homeTeam || {};
  const awayTeam = match.awayTeam || {};
  const score = match.score?.fullTime || {};
  const externalLeagueId = match.competition?.id;

  return {
    id: String(match.id),
    title: `${homeTeam.name} vs ${awayTeam.name}`,
    date: new Date(match.utcDate).getTime(),
    league: match.competition?.name || 'Otros',
    leagueId: EXTERNAL_TO_INTERNAL_ID[externalLeagueId] || externalLeagueId,
    competitionCode: match.competition?.code || null,
    stage: match.stage || null, // ROUND_OF_16, QUARTER_FINALS, etc.
    matchday: match.matchday || null,
    season: match.season?.id || null,
    teams: {
      home: {
        name: homeTeam.name || 'N/A',
        badge: homeTeam.crest || '',
        id: homeTeam.id,
      },
      away: {
        name: awayTeam.name || 'N/A',
        badge: awayTeam.crest || '',
        id: awayTeam.id,
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
  getMatchById,
  findFirstLegMatch,
  getStandings,
  getRounds,
};