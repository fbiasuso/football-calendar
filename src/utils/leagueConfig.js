// League configuration for Football Calendar

// API-Football league IDs for each league name
export const API_FOOTBALL_LEAGUE_IDS = {
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
    leagues: ['Copa Libertadores', 'Copa Sudamericana'],
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
    leagues: ['LaLiga', 'Copa del Rey', 'Supercopa'],
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