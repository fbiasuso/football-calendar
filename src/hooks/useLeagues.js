// useLeagues hook - League filter state management
import useAppStore from '../store/useAppStore.js';

export function useLeagues() {
  const {
    selectedLeagues,
    toggleLeague,
    setSelectedLeagues,
    resetFilters,
  } = useAppStore();
  
  return {
    selectedLeagues,
    toggleLeague,
    setSelectedLeagues,
    resetFilters,
    isLeagueSelected: (leagueName) => selectedLeagues.includes(leagueName),
  };
}

export default useLeagues;