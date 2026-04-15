// Football Calendar App
import { useMatches } from './hooks/useMatches.js';
import useAppStore from './store/useAppStore.js';
import MatchList from './components/MatchList/MatchList.jsx';
import LeagueFilter from './components/LeagueFilter/LeagueFilter.jsx';
import DateNav from './components/DateNav/DateNav.jsx';
import SortControl from './components/SortControl/SortControl.jsx';

function App() {
  const { matches, isLoading, error, refresh } = useMatches();
  const { error: storeError, autoPollingEnabled, setAutoPolling } = useAppStore();
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800">
              ⚽ Football Calendar
            </h1>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Refresh button */}
              <button
                onClick={refresh}
                disabled={isLoading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Refrescar"
              >
                <svg 
                  className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              {/* Auto-polling toggle */}
              <button
                onClick={() => setAutoPolling(!autoPollingEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  autoPollingEnabled 
                    ? 'bg-green-100 text-green-700' 
                    : 'hover:bg-gray-100 text-gray-600'
                }`}
                aria-label={autoPollingEnabled ? 'Auto-actualizar ON' : 'Auto-actualizar OFF'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
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
      </main>
    </div>
  );
}

export default App;