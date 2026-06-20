// SubTabBar component - World Cup sub-navigation (Grupos / Llaves)
import useAppStore from '../../store/useAppStore.js';

export default function SubTabBar() {
  const { wcTab, setWcTab } = useAppStore();

  const tabs = [
    { key: 'grupos', label: 'Grupos' },
    { key: 'llaves', label: 'Llaves' },
  ];

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setWcTab(tab.key)}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            wcTab === tab.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
