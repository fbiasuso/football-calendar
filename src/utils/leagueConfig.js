// League configuration for Football Calendar
// Using football-data.org API

export const LEAGUE_GROUPS = {
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

// Default selected leagues (football-data.org)
export const DEFAULT_SELECTED_LEAGUES = [
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