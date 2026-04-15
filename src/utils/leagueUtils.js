// League matching utilities for Football Calendar
// Used to match leagues from API response to our configured leagues

import { LEAGUE_GROUPS } from './leagueConfig';

// Normalize league name for comparison
export function normalizeLeagueName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ')
    .trim();
}

// Match a league from API data to our configured leagues
export function matchLeagueFromTitle(title, leagueId) {
  if (!title && !leagueId) return null;
  
  const searchText = (title + ' ' + leagueId).toLowerCase();
  
  // Check each configured league
  for (const [groupKey, group] of Object.entries(LEAGUE_GROUPS)) {
    for (const leagueName of group.leagues) {
      const normalizedLeague = normalizeLeagueName(leagueName);
      const normalizedTitle = normalizeLeagueName(searchText);
      
      if (normalizedTitle.includes(normalizedLeague)) {
        return {
          id: leagueName,
          name: leagueName,
          group: groupKey,
        };
      }
    }
  }
  
  return null;
}

// Get priority for sorting (Argentina = 0, others later)
export function getLeaguePriority(leagueName) {
  const priorities = {
    'Liga Profesional': 0,
    'Copa Argentina': 1,
    'Copa de la Liga': 2,
  };
  
  return priorities[leagueName] ?? 100;
}

// Sort leagues for display (Argentina first, then alphabetically)
export function sortLeaguesForDisplay(leagues) {
  return [...leagues].sort((a, b) => {
    const priorityA = getLeaguePriority(a.name);
    const priorityB = getLeaguePriority(b.name);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    return a.name.localeCompare(b.name);
  });
}