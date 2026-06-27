// League configuration for Football Calendar

// Internal league IDs (mapped to provider-specific IDs via the adapter/edge function)
// Named INTERNAL_LEAGUE_IDS per spec; LEAGUE_IDS exported as alias for backward compat
export const INTERNAL_LEAGUE_IDS = {
  'World Cup 2026': 1,
  'UEFA Champions League': 2,
  'Premier League': 3,
  'LaLiga': 4,
  'Bundesliga': 5,
  'Serie A': 6,
  'FA Cup': 7,
  'Copa del Rey': 8,
  'DFB-Pokal': 9,
  'Coppa Italia': 10,
  'EFL Cup': 11,
  'Copa Libertadores': 12,
  'Argentine Liga Profesional': 13,
};

// Alias for backward compatibility
export const LEAGUE_IDS = INTERNAL_LEAGUE_IDS;

// football-data.org v4 competition IDs (external — used by the API)
export const FOOTBALL_DATA_COMPETITION_IDS = {
  'World Cup 2026': 2000,
  'UEFA Champions League': 2001,
  'Premier League': 2021,
  'LaLiga': 2014,
  'Bundesliga': 2002,
  'Serie A': 2019,
  'FA Cup': 2055,
  'Copa del Rey': 2079,
  'DFB-Pokal': 2011,
  'Coppa Italia': 2122,
  'EFL Cup': 2139,
  'Copa Libertadores': 2152,
  'Argentine Liga Profesional': 2024,
};

export const LEAGUE_GROUPS = {
  mundial: {
    name: 'Mundial',
    leagues: ['World Cup 2026'],
  },
  champions: {
    name: 'Champions League',
    leagues: ['UEFA Champions League'],
  },
  libertadores: {
    name: 'Copa Libertadores',
    leagues: ['Copa Libertadores'],
  },
  argentina: {
    name: 'Argentina',
    leagues: ['Argentine Liga Profesional'],
  },
  inglaterra: {
    name: 'Inglaterra',
    leagues: ['Premier League', 'FA Cup', 'EFL Cup'],
  },
  espana: {
    name: 'España',
    leagues: ['LaLiga', 'Copa del Rey'],
  },
  italia: {
    name: 'Italia',
    leagues: ['Serie A', 'Coppa Italia'],
  },
  alemania: {
    name: 'Alemania',
    leagues: ['Bundesliga', 'DFB-Pokal'],
  },
};

// Default selected leagues
export const DEFAULT_SELECTED_LEAGUES = [
  'World Cup 2026',
  'UEFA Champions League',
  'Copa Libertadores',
  'Argentine Liga Profesional',
  'Premier League',
  'LaLiga',
  'Serie A',
  'Bundesliga',
];

// Get all leagues flattened
export function getAllLeagues() {
  return Object.entries(LEAGUE_GROUPS).flatMap(([groupKey, group]) =>
    group.leagues.map((league) => ({
      id: league,
      name: league,
      group: groupKey,
      groupName: group.name,
    }))
  );
}

// Get leagues by group
export function getLeaguesByGroup() {
  return Object.entries(LEAGUE_GROUPS).map(([groupKey, group]) => ({
    key: groupKey,
    name: group.name,
    leagues: group.leagues,
  }));
}