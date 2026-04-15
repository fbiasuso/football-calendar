// League configuration for Football Calendar
// Used for filtering and display

export const LEAGUE_GROUPS = {
  argentina: {
    name: 'Argentina',
    leagues: [
      'Liga Profesional',
      'Copa Argentina',
      'Copa de la Liga',
    ],
  },
  internacional: {
    name: 'Internacional',
    leagues: [
      'Copa Libertadores',
      'Copa Sudamericana',
      'Champions League',
      'Copa Intercontinental',
      'Europa League',
      'Conference League',
      'Mundial de Clubes',
    ],
  },
  inglaterra: {
    name: 'Inglaterra',
    leagues: [
      'Premier League',
      'Carabao Cup',
      'FA Cup',
    ],
  },
  espana: {
    name: 'España',
    leagues: [
      'La Liga',
      'Copa del Rey',
      'Supercopa',
    ],
  },
  italia: {
    name: 'Italia',
    leagues: [
      'Serie A',
      'Coppa Italia',
      'Supercopa',
    ],
  },
  alemania: {
    name: 'Alemania',
    leagues: [
      'Bundesliga',
      'DFB-Pokal',
    ],
  },
};

// Default selected leagues (pre-selected on first load)
export const DEFAULT_SELECTED_LEAGUES = [
  // Argentina
  'Liga Profesional',
  'Copa Argentina',
  'Copa de la Liga',
  // Internacional
  'Champions League',
  // Inglaterra
  'Premier League',
  // España
  'La Liga',
  // Italia
  'Serie A',
  // Alemania
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