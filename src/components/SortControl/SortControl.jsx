// SortControl component - Toggle between time and league sorting
import useAppStore from '../../store/useAppStore.js';

export default function SortControl() {
  const { sortMode, setSortMode } = useAppStore();
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 inline-flex">
      <button
        onClick={() => setSortMode('time')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          sortMode === 'time'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        Por horario
      </button>
      <button
        onClick={() => setSortMode('league')}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          sortMode === 'league'
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        Por liga
      </button>
    </div>
  );
}