// LeagueFilter component - Checkbox filters for leagues
import { getLeaguesByGroup } from '../../utils/leagueConfig.js';
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
            {leagues.map(league => (
              <label 
                key={league}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedLeagues.includes(league)}
                  onChange={() => toggleLeague(league)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  {league}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}