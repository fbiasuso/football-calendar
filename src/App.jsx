// Football Calendar App
import { useState, useEffect, useMemo } from 'react';
import { useMatches } from './hooks/useMatches.js';
import useAppStore from './store/useAppStore.js';
import NavBar from './components/NavBar/NavBar.jsx';
import MatchList from './components/MatchList/MatchList.jsx';
import LeagueFilter from './components/LeagueFilter/LeagueFilter.jsx';
import DateNav from './components/DateNav/DateNav.jsx';
import SortControl from './components/SortControl/SortControl.jsx';
import WorldCupPage from './pages/WorldCupPage/WorldCupPage.jsx';
import { formatRelativeTime } from './utils/dateUtils.js';
import { getBudget, toggleFastMode } from './api/adapter.js';

const HAS_SUPABASE = !!import.meta.env.VITE_SUPABASE_URL;

function App() {
  const { matches, isLoading, error, refresh, hasLiveMatches } = useMatches();
  const { error: storeError, autoPollingEnabled, setAutoPolling, currentView, lastUpdated } = useAppStore();
  const fastMode = useAppStore((s) => s.fastMode);
  const setFastMode = useAppStore((s) => s.setFastMode);
  const [budget, setBudget] = useState(null);
  const [forceFetchLoading, setForceFetchLoading] = useState(false);
  const [clockTick, setClockTick] = useState(0);

  // Tick each minute so relative time updates
  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Budget polling (Supabase mode only)
  useEffect(() => {
    if (!HAS_SUPABASE) return;

    const loadBudget = async () => {
      try {
        const data = await getBudget();
        setBudget(data);
      } catch (err) {
        // Silent — budget is non-critical
      }
    };

    loadBudget();
    const interval = setInterval(loadBudget, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const relativeTime = useMemo(() => formatRelativeTime(lastUpdated), [lastUpdated, clockTick]);

  const hasMatchInLast5 = useMemo(() => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return matches.some(m => m.status === 'live' && m.date > fiveMinAgo);
  }, [matches, clockTick]);


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              ⚽ Football Calendar
            </h1>
            
            <div className="flex items-center gap-1.5">
              {HAS_SUPABASE ? (
                <>
                  {/* Forzar actualización (Supabase) */}
                  <button
                    onClick={async () => {
                      if (forceFetchLoading) return;
                      setForceFetchLoading(true);
                      try {
                        const store = useAppStore.getState();
                        await store.forceRefresh();
                      } catch (err) {
                        console.error('Force fetch failed:', err);
                      } finally {
                        setTimeout(() => setForceFetchLoading(false), 30000);
                      }
                    }}
                    disabled={forceFetchLoading}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      forceFetchLoading ? 'text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title={forceFetchLoading ? 'Esperá 30s' : 'Forzar actualización desde API'}
                    aria-label="Forzar actualización"
                  >
                    <svg className={`w-5 h-5 ${forceFetchLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  {/* Fast Mode (Supabase) */}
                  <button
                    onClick={async () => {
                      const newVal = !fastMode;
                      try {
                        await toggleFastMode(newVal);
                        setFastMode(newVal);
                      } catch (err) {
                        console.error('Failed to toggle fast mode:', err);
                      }
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      fastMode
                        ? 'bg-green-100 text-green-700'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    title={fastMode ? 'Modo rápido activo' : 'Activar modo rápido'}
                    aria-label="Modo rápido"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>

                  {/* Budget indicator (Supabase) */}
                  {budget && (
                    <span
                      className={`text-[11px] font-mono px-1.5 py-1 rounded ${
                        budget.api_requests_today >= 80
                          ? 'bg-red-100 text-red-700'
                          : budget.api_requests_today >= 50
                            ? 'bg-amber-100 text-amber-700'
                            : 'text-gray-400'
                      }`}
                      title={`${budget.api_budget - budget.api_requests_today} solicitudes restantes hoy`}
                    >
                      {budget.api_requests_today}/{budget.api_budget}
                    </span>
                  )}
                </>
              ) : (
                <>
                  {/* Auto-polling toggle (non-Supabase) */}
                  <button
                    onClick={() => setAutoPolling(!autoPollingEnabled)}
                    title={
                      autoPollingEnabled && hasLiveMatches
                        ? `Cada ${hasMatchInLast5 ? '1' : '5'} min`
                        : 'Activar auto-actualización'
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      autoPollingEnabled
                        ? hasLiveMatches
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    aria-label={autoPollingEnabled ? 'Auto-actualizar ON' : 'Auto-actualizar OFF'}
                  >
                    <div className="flex items-center gap-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {autoPollingEnabled && hasLiveMatches && (
                        <span className="text-[9px] font-bold">{hasMatchInLast5 ? '1' : '5'}min</span>
                      )}
                    </div>
                  </button>

                  {/* Refresh button (non-Supabase) */}
                  <button
                    onClick={refresh}
                    disabled={isLoading}
                    title="Refrescar partidos"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Refrescar"
                  >
                    <svg className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* lastUpdated indicator */}
            {lastUpdated && (
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-gray-400">
                  Última actualización: {relativeTime}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Navigation tabs */}
        <NavBar />
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentView === 'matches' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar - League filters */}
            <aside className="lg:w-64 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-24">
                <h2 className="font-semibold text-gray-800 mb-4">
                  Filtrar ligas
                </h2>
                <LeagueFilter />
              </div>
            </aside>
            
            {/* Main content area */}
            <div className="flex-1">
              {/* Date navigation and sort control */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <DateNav />
                <SortControl />
              </div>
              
              {/* Error state */}
              {(error || storeError) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-700 text-sm">
                    {error || storeError}
                  </p>
                  <button
                    onClick={refresh}
                    className="text-red-600 text-sm underline mt-1"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
              
              {/* Loading state */}
              {isLoading && matches.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {/* Match list */}
              {!isLoading && (
                <MatchList matches={matches} />
              )}
            </div>
          </div>
        )}

        {currentView === 'worldcup' && (
          <WorldCupPage />
        )}
      </main>
    </div>
  );
}

export default App;