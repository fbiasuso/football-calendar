import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMatches } from '../api/adapter.js';
import { getDateKey } from '../utils/dateUtils.js';
import { DEFAULT_SELECTED_LEAGUES } from '../utils/leagueConfig.js';
import { TOURNAMENT_GRAPH } from '../pages/WorldCupPage/Bracket/bracketGraph.js';

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

      // World Cup navigation
      currentView: 'matches', // 'matches' | 'worldcup'
      wcTab: 'grupos',       // 'grupos' | 'llaves'

      // World Cup data (excluded from localStorage persistence)
      wcStandings: null,     // Array<{group, teams}> | null
      wcRounds: null,        // string[] | null
      wcBracket: null,       // {fixedMatchups, thirdPlaceSlots} | null (override layer only)

      // Bracket pick'em (persisted via partialize)
      wcPicks: {},           // { [matchupId]: 'home' | 'away' }
      bracketMode: 'locked', // 'locked' | 'editing'
      
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

      // World Cup navigation setters
      setCurrentView: (view) => set((state) => ({
        currentView: view,
        // Reset wcTab to 'grupos' each time user switches to World Cup
        wcTab: view === 'worldcup' ? 'grupos' : state.wcTab,
      })),
      setWcTab: (tab) => set({ wcTab: tab }),

      // World Cup data setters
      setWcStandings: (standings) => set({ wcStandings: standings }),
      setWcRounds: (rounds) => set({ wcRounds: rounds }),
      setWcBracket: (bracket) => set({ wcBracket: bracket }),

      // Bracket pick'em actions
      setWcPick: (matchupId, side) => set((state) => {
        const newPicks = { ...state.wcPicks, [matchupId]: side };
        // Walk DAG forward and clear downstream picks
        let current = matchupId;
        while (TOURNAMENT_GRAPH[current]?.feedsInto) {
          const next = TOURNAMENT_GRAPH[current].feedsInto;
          delete newPicks[next];
          current = next;
        }
        return { wcPicks: newPicks };
      }),
      setBracketMode: (mode) => set({ bracketMode: mode }),
      clearWcPicks: () => set({ wcPicks: {} }),
      
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
        wcPicks: state.wcPicks,
        bracketMode: state.bracketMode,
      }),
    }
  )
);

export default useAppStore;