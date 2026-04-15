import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMatches } from '../api/adapter.js';
import { getDateKey } from '../utils/dateUtils.js';
import { DEFAULT_SELECTED_LEAGUES } from '../utils/leagueConfig.js';

const useAppStore = create(
  persist(
    (set, get) => ({
      // State
      matches: [],
      selectedDate: new Date(),
      selectedLeagues: DEFAULT_SELECTED_LEAGUES,
      sortMode: 'time', // 'time' | 'league'
      isLoading: false,
      error: null,
      autoPollingEnabled: false,
      lastUpdated: null,
      
      // Actions
      setMatches: (matches) => set({ 
        matches, 
        lastUpdated: new Date(),
        error: null 
      }),
      
      setSelectedDate: (date) => set({ selectedDate: date }),
      
      toggleLeague: (leagueName) => set((state) => {
        const leagues = state.selectedLeagues;
        if (leagues.includes(leagueName)) {
          return { selectedLeagues: leagues.filter(l => l !== leagueName) };
        }
        return { selectedLeagues: [...leagues, leagueName] };
      }),
      
      setSelectedLeagues: (leagues) => set({ selectedLeagues: leagues }),
      
      setSortMode: (mode) => set({ sortMode: mode }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error }),
      
      setAutoPolling: (enabled) => set({ autoPollingEnabled: enabled }),
      
      // Async action to fetch matches
      fetchMatches: async () => {
        const { selectedDate, setLoading, setMatches, setError } = get();
        setLoading(true);
        
        try {
          const matches = await getMatches(selectedDate);
          setMatches(matches);
        } catch (error) {
          console.error('Error fetching matches:', error);
          setError(error.message || 'Error al cargar partidos');
        } finally {
          setLoading(false);
        }
      },
      
      // Clear error
      clearError: () => set({ error: null }),
      
      // Reset filters to default
      resetFilters: () => set({ selectedLeagues: DEFAULT_SELECTED_LEAGUES }),
    }),
    {
      name: 'fc-store',
      partialize: (state) => ({
        selectedLeagues: state.selectedLeagues,
        sortMode: state.sortMode,
        autoPollingEnabled: state.autoPollingEnabled,
      }),
    }
  )
);

export default useAppStore;