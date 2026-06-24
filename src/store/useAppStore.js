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
      fastMode: false,
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
      wcSlots: {},           // { [slotId]: { name, logo, group } | null }
      bracketMode: 'locked', // 'locked' | 'editing'
      
      // Actions
      setMatches: (matches, dataTimestamp) => set({ 
        matches, 
        lastUpdated: dataTimestamp || new Date(),
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

      setFastMode: (enabled) => set({ fastMode: enabled }),

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
      setWcSlot: (slotId, team) => set((state) => {
        const newSlots = { ...state.wcSlots, [slotId]: team };
        // Clear downstream picks when slot changes
        const newPicks = { ...state.wcPicks };
        const matchupId = slotId.replace(/-(home|away)$/, '');
        let current = matchupId;
        while (TOURNAMENT_GRAPH[current]?.feedsInto) {
          const next = TOURNAMENT_GRAPH[current].feedsInto;
          delete newPicks[next];
          current = next;
        }
        return { wcSlots: newSlots, wcPicks: newPicks };
      }),
      clearWcSlot: (slotId) => set((state) => {
        const newSlots = { ...state.wcSlots };
        delete newSlots[slotId];
        return { wcSlots: newSlots };
      }),
      clearAllWcSlots: () => set({ wcSlots: {} }),
      
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

      // Force a full API refresh via Edge Function (Supabase mode only)
      forceRefresh: async () => {
        const { setLoading, setMatches, setError } = get();
        setLoading(true);
        try {
          const { triggerForceFetch } = await import('../api/supabaseAdapter.js');
          const result = await triggerForceFetch();
          // Refetch matches from DB — Realtime will also propagate
          const { getMatches } = await import('../api/adapter.js');
          const matches = await getMatches(get().selectedDate);
          setMatches(matches);
          return result;
        } catch (err) {
          setError(err.message || 'Error al forzar actualización');
          return null;
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
        fastMode: state.fastMode,
        wcPicks: state.wcPicks,
        wcSlots: state.wcSlots,
        bracketMode: state.bracketMode,
      }),
    }
  )
);

export default useAppStore;