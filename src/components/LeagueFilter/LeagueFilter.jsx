// LeagueFilter component - Checkbox filters for leagues
import { getLeaguesByGroup, LEAGUE_DISPLAY_NAMES } from '../../utils/leagueConfig.js';
import useAppStore from '../../store/useAppStore.js';

export default function LeagueFilter() {
  const { selectedLeagues, toggleLeague } = useAppStore();
  const leaguesByGroup = getLeaguesByGroup();
  
  return (
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
}