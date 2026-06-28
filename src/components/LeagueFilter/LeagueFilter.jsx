// LeagueFilter component - Checkbox filters for leagues
import { useState } from 'react';
import { getLeaguesByGroup, LEAGUE_DISPLAY_NAMES } from '../../utils/leagueConfig.js';
import useAppStore from '../../store/useAppStore.js';

export default function LeagueFilter({ isCollapsed: controlledCollapsed, onToggleCollapse } = {}) {
  const { selectedLeagues, toggleLeague } = useAppStore();
  const leaguesByGroup = getLeaguesByGroup();
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledCollapsed !== undefined ? !controlledCollapsed : internalOpen;
  const toggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalOpen(o => !o);
    }
  };

  const selectedCount = selectedLeagues.length;
  const totalCount = leaguesByGroup.reduce((s, g) => s + g.leagues.length, 0);

  const filterList = (
    <div className="space-y-4">
      {leaguesByGroup.map(({ key, name, leagues }) => (
        <div key={key}>
          <h3 className="font-semibold text-gray-700 text-sm mb-2">
            {name}
          </h3>
          <div className="space-y-1">
            {leagues.map(identifier => (
              <label 
                key={identifier}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes(identifier)}
                  onChange={() => toggleLeague(identifier)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {LEAGUE_DISPLAY_NAMES[identifier] || identifier}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* Mobile toggle bar */}
      <button
        onClick={toggle}
        className="lg:hidden w-full flex items-center justify-between gap-2 bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>Filtrar ligas</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {selectedCount}/{totalCount}
          </span>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Filter content — collapsible on mobile, always visible on desktop */}
      <div className={`${isOpen ? 'block' : 'hidden'} lg:block mt-2 lg:mt-0`}>
        {filterList}
      </div>
    </>
  );
}