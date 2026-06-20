// NavBar component - Top-level navigation tabs
import useAppStore from '../../store/useAppStore.js';

export default function NavBar() {
  const { currentView, setCurrentView } = useAppStore();

  const tabs = [
    { key: 'matches', label: 'Partidos' },
    { key: 'worldcup', label: 'Mundial 2026' },
  ];

  return (
    <nav className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCurrentView(tab.key)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                currentView === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
