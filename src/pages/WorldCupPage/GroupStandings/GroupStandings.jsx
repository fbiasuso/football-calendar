// GroupStandings component - 4×3 responsive grid of group tables
import GroupTable from './GroupTable.jsx';
import ThirdPlaceTable from './ThirdPlaceTable.jsx';

export default function GroupStandings({ standings, loading, error, onRetry }) {
  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
          <p className="text-red-700 font-medium mb-2">Error al cargar las posiciones</p>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state (no data yet)
  if (!standings || standings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 font-medium">No hay datos</p>
          <p className="text-gray-400 text-sm mt-1">Las posiciones estarán disponibles cuando comience el torneo.</p>
        </div>
      </div>
    );
  }

  // 4×3 responsive grid
  return (
    <>
      {/* Referencias */}
      <div className="flex items-center gap-5 mb-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          Clasificados a 16vos de final
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 flex-shrink-0" />
          Al Ranking de mejores 3°
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {standings.map((group) => (
          <GroupTable key={group.group} group={group} />
        ))}
      </div>
      <ThirdPlaceTable standings={standings} />
    </>
  );
}
