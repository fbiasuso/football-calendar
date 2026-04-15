// SportSRC API Client for Football Calendar
// Documentation: https://sportsrc.org/

const BASE_URL = 'https://api.sportsrc.org/';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff

/**
 * @typedef {Object} SportSRCMatch
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {number} date - Unix timestamp
 * @property {boolean} popular
 * @property {string} poster
 * @property {Object} teams
 * @property {Object} teams.home
 * @property {string} teams.home.name
 * @property {string} teams.home.badge
 * @property {Object} teams.away
 * @property {string} teams.away.name
 * @property {string} teams.away.badge
 */

/**
 * Make request with retry and exponential backoff
 */
async function fetchWithRetry(url, options = {}, retries = 0) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 503 && retries < MAX_RETRIES - 1) {
        // Service unavailable - retry with backoff
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries]));
        return fetchWithRetry(url, options, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown API error');
    }

    return data.data || [];
  } catch (error) {
    if (retries < MAX_RETRIES - 1 && error.message.includes('fetch')) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retries]));
      return fetchWithRetry(url, options, retries + 1);
    }
    throw error;
  }
}

/**
 * Fetch all matches from SportSRC
 */
async function fetchMatches(date) {
  const dateKey = typeof date === 'string' ? date : formatDateKey(date);
  const url = `${BASE_URL}?data=matches&category=football`;
  
  const matches = await fetchWithRetry(url);
  return matches;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDateKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extract league name from match data
 * SportSRC doesn't provide league name directly, so we infer from title/ID
 * Priority: 1) league keywords, 2) team names
 */
function extractLeague(match) {
  const searchText = (match.title + ' ' + match.id).toLowerCase();
  
  // FIRST: Check for league keywords (higher priority)
  const leaguePatterns = [
    { pattern: 'liga profesional', name: 'Liga Profesional' },
    { pattern: 'copa argentina', name: 'Copa Argentina' },
    { pattern: 'copa de la liga', name: 'Copa de la Liga' },
    { pattern: 'libertadores', name: 'Copa Libertadores' },
    { pattern: 'sudamericana', name: 'Copa Sudamericana' },
    { pattern: 'ucl ', name: 'Champions League' },
    { pattern: 'champions league', name: 'Champions League' },
    { pattern: 'champions', name: 'Champions League' },
    { pattern: 'intercontinental', name: 'Copa Intercontinental' },
    { pattern: 'europa league', name: 'Europa League' },
    { pattern: 'conference', name: 'Conference League' },
    { pattern: 'mundial de clubes', name: 'Mundial de Clubes' },
    { pattern: 'premier league', name: 'Premier League' },
    { pattern: 'carabao', name: 'Carabao Cup' },
    { pattern: 'fa cup', name: 'FA Cup' },
    { pattern: 'la liga', name: 'La Liga' },
    { pattern: 'copa del rey', name: 'Copa del Rey' },
    { pattern: 'supercopa', name: 'Supercopa' },
    { pattern: 'serie a', name: 'Serie A' },
    { pattern: 'coppa italia', name: 'Coppa Italia' },
    { pattern: 'bundesliga', name: 'Bundesliga' },
    { pattern: 'dfb-pokal', name: 'DFB-Pokal' },
  ];
  
  for (const { pattern, name } of leaguePatterns) {
    if (searchText.includes(pattern)) {
      return name;
    }
  }
  
  // Skip matches with null teams (like "UCL Multicast")
  const homeName = match.teams?.home?.name;
  const awayName = match.teams?.away?.name;
  if (!homeName && !awayName) {
    return 'Otros'; // Skip "por confirmar" matches
  }
  
  // SECOND: Try to deduce league from team names
  const teamNamePatterns = {
    'Liga Profesional': [
      'river', 'boca', 'independiente', 'racing', 'san lorenzo', 'huracán', 'vélez',
      'lanús', 'godoy cruz', 'belgrano', 'central córdoba', 'platense',
      'talleres', 'unión', 'huracán', 'boca juniors', 'river plate', 'club atlético',
      'gimnasia', 'estudiantes', 'rosario central', 'newell', 'atético tucumán',
      'banfield', 'patronato', 'arsenal', 'chaco for ever', 'quilmes', 'brown'
    ],
    'Copa Argentina': ['copa argentina'],
    'Copa de la Liga': ['copa de la liga'],
    'Copa Libertadores': ['libertadores'],
    'Copa Sudamericana': ['sudamericana'],
    'Champions League': [
      'real madrid', 'barcelona', 'bayern', 'manchester city', 'liverpool', 
      'chelsea', 'arsenal', 'tottenham', 'psg', 'juventus', 'inter', 'milan',
      'sporting', 'monaco', 'dortmund', 'leverkusen', 'atletico'
    ],
    'Premier League': [
      'manchester united', 'manchester city', 'liverpool', 'chelsea', 
      'arsenal', 'tottenham', 'newcastle', 'west ham', 'aston villa', 
      'fulham', 'wolves', 'brighton', 'crystal palace', 'everton'
    ],
    'La Liga': [
      'real madrid', 'barcelona', 'atlético madrid', 'sevilla', 
      'valencia', 'villarreal', 'real betis', 'real sociedad', 'osasuna', 'celta'
    ],
    'Serie A': [
      'juventus', 'inter', 'milan', 'napoli', 'roma', 'lazio', 
      'fiorentina', 'atalanta', 'torino', 'sampdoria', 'bologna'
    ],
    'Bundesliga': [
      'bayern munich', 'borussia dortmund', 'rb leipzig', 'leverkusen',
      'frankfurt', 'wolfsburg', 'stuttgart'
    ],
  };
  
  const titleLower = match.title?.toLowerCase() || '';
  for (const [league, teams] of Object.entries(teamNamePatterns)) {
    for (const team of teams) {
      if (titleLower.includes(team)) {
        return league;
      }
    }
  }
  
  return 'Otros';
}

/**
 * Determine match status from match data
 * SportSRC doesn't provide status directly - infer from timestamp
 */
function getMatchStatus(match) {
  const now = Date.now();
  const matchTime = match.date;
  const thirtyMins = 30 * 60 * 1000;
  
  // Future match: more than 30 min to start
  if (matchTime > now + thirtyMins) {
    return 'pending';
  }
  
  // Match starts within 30 min but hasn't started yet → pending (about to start)
  if (matchTime > now && matchTime <= now + thirtyMins) {
    return 'pending';
  }
  
  // Match is within expected time (started but no end time data) → live
  // We'll mark as live if within 2 hours of start time (120 min)
  if (matchTime > now - thirtyMins && matchTime <= now + (120 * 60 * 1000)) {
    return 'live';
  }
  
  // Otherwise, it's finished
  return 'finished';
}

/**
 * Normalize SportSRC match data to our internal format
 * @param {SportSRCMatch} match
 * @returns {import('./adapter.js').Match}
 */
function normalizeMatch(match) {
  const home = match.teams?.home || {};
  const away = match.teams?.away || {};
  
  return {
    id: match.id,
    title: match.title,
    date: match.date,
    league: extractLeague(match),
    teams: {
      home: {
        name: home.name || 'por confirmar',
        badge: home.badge || '',
      },
      away: {
        name: away.name || 'por confirmar',
        badge: away.badge || '',
      },
    },
    status: getMatchStatus(match),
    poster: match.poster || '',
  };
}

/**
 * Get all matches for a date
 * Note: SportSRC API doesn't support date filtering, returns all matches
 * We filter by date client-side
 * @param {Date|string} date
 * @returns {Promise<import('./adapter.js').Match[]>}
 */
export async function getMatches(date) {
  const matches = await fetchMatches(date);
  
  // Parse target date
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const targetDateStart = targetDate.getTime();
  const targetDateEnd = targetDateStart + 24 * 60 * 60 * 1000;
  
  // Filter matches for the requested date
  const filtered = matches.filter(match => {
    const matchDate = match.date;
    return matchDate >= targetDateStart && matchDate < targetDateEnd;
  });
  
  // If no matches for date, return matches from nearby days
  if (filtered.length === 0) {
    // Try 3 days before and after
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const altDate = new Date(targetDate);
      altDate.setDate(altDate.getDate() + i);
      const altStart = altDate.getTime();
      const altEnd = altStart + 24 * 60 * 60 * 1000;
      const altMatches = matches.filter(m => m.date >= altStart && m.date < altEnd);
      if (altMatches.length > 0) {
        return altMatches.map(normalizeMatch).filter(m => m.teams.home.name !== 'por confirmar' && m.teams.away.name !== 'por confirmar').sort((a, b) => a.date - b.date);
      }
    }
  }
  
  return filtered
    .map(normalizeMatch)
    .filter(m => m.teams.home.name !== 'por confirmar' && m.teams.away.name !== 'por confirmar')
    .sort((a, b) => a.date - b.date);
}

/**
 * Get live matches (mock - SportSRC v1 doesn't have live endpoint)
 * @param {Date|string} date
 * @returns {Promise<import('./adapter.js').Match[]>}
 */
export async function getLiveMatches(date) {
  // For now, return all matches - in future when we have live data,
  // we'd filter for in-progress matches
  const matches = await getMatches(date);
  return matches.filter(m => m.status === 'live');
}

/**
 * Get available leagues (inferred from matches)
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function getLeagues() {
  const matches = await fetchMatches(new Date());
  const leagueSet = new Set();
  
  matches.forEach(match => {
    leagueSet.add(extractLeague(match));
  });
  
  return Array.from(leagueSet)
    .map(id => ({ id, name: id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Export client object for use in adapter
export const sportsrcClient = {
  getMatches,
  getLiveMatches,
  getLeagues,
};