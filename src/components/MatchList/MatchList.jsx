// MatchList component - List of matches with sorting
import { useMemo } from 'react';
import useAppStore from '../../store/useAppStore.js';
import MatchCard from '../MatchCard/MatchCard.jsx';
import { getLeaguePriority } from '../../utils/leagueUtils.js';

export default function MatchList({ matches }) {
  const { selectedLeagues, sortMode } = useAppStore();
  
  // Filter and sort matches
  const processedMatches = useMemo(() => {
    if (!matches || matches.length === 0) return [];
    
    // If no leagues selected, show all
    let filtered;
    if (!selectedLeagues || selectedLeagues.length === 0) {
      filtered = matches;
    } else {
      filtered = matches.filter(m => selectedLeagues.includes(m.leagueIdentifier || m.league));
    }
    
    if (sortMode === 'time') {
      // Sort by time (all mixed together), wrap each match
      return filtered
        .sort((a, b) => a.date - b.date)
        .map(match => ({ type: 'match', data: match }));
    }
    
    // Sort by league ( Argentina first, then others by time within each league)
    const grouped = {};
    
    filtered.forEach(match => {
      const league = match.league || 'Otros';
      if (!grouped[league]) {
        grouped[league] = [];
      }
      grouped[league].push(match);
    });
    
    // Sort within each group by time
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => a.date - b.date);
    });
    
    // Get unique leagues and sort by priority
    const leagues = Object.keys(grouped).sort((a, b) => {
      const priorityA = getLeaguePriority(a);
      const priorityB = getLeaguePriority(b);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.localeCompare(b);
    });
    
    // Flatten with league headers
    const result = [];
    leagues.forEach(league => {
      // Add header for each league
      result.push({
        type: 'header',
        league,
      });
      // Add matches for this league
      grouped[league].forEach(match => {
        result.push({
          type: 'match',
          data: match,
        });
      });
    });
    
    return result;
  }, [matches, selectedLeagues, sortMode]);
  
  if (processedMatches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No hay partidos para los filtros seleccionados</p>
        <p className="text-sm mt-2">Intenta seleccionar más ligas</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {processedMatches.map((item, index) => {
        // Skip invalid items
        if (!item || !item.type) {
          return null;
        }
        
        if (item.type === 'header') {
          return (
            <div 
              key={`header-${item.league}`}
              className="sticky top-0 bg-gray-50 py-2 px-4 border-b border-gray-200 mt-4 first:mt-0"
            >
              <h3 className="font-semibold text-gray-700 text-sm">
                {item.league}
              </h3>
            </div>
          );
        }
        
        // Ensure match data exists
        if (!item.data || !item.data.id) {
          return null;
        }
        
        return (
          <MatchCard key={item.data.id} match={item.data} />
        );
      })}
    </div>
  );
}