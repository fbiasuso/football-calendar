// MatchCard component - Individual match display
import { formatTime } from '../../utils/dateUtils.js';

export default function MatchCard({ match }) {
  const { title, teams, status, league, date } = match;
  
  const homeTeam = teams?.home || { name: 'por confirmar', badge: '' };
  const awayTeam = teams?.away || { name: 'por confirmar', badge: '' };
  
  // Status badge color
  const statusColors = {
    pending: 'bg-gray-200 text-gray-700',
    live: 'bg-red-500 text-white animate-pulse',
    finished: 'bg-green-200 text-green-700',
  };
  
  const statusLabel = {
    pending: formatTime(date),
    live: 'EN VIVO',
    finished: 'FINALIZADO',
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* League name */}
      <div className="text-xs text-gray-500 mb-2 font-medium">
        {league}
      </div>
      
      {/* Teams */}
      <div className="flex items-center justify-between">
        {/* Home team */}
        <div className="flex items-center gap-3 flex-1">
          {homeTeam.badge && (
            <img 
              src={homeTeam.badge} 
              alt={homeTeam.name}
              className="w-8 h-8"
            />
          )}
          <span className="font-semibold text-gray-900 text-sm">
            {homeTeam.name}
          </span>
        </div>
        
        {/* VS / Score */}
        <div className="px-3 text-gray-400 text-xs">
          vs
        </div>
        
        {/* Away team */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="font-semibold text-gray-900 text-sm text-right">
            {awayTeam.name}
          </span>
          {awayTeam.badge && (
            <img 
              src={awayTeam.badge} 
              alt={awayTeam.name}
              className="w-8 h-8"
            />
          )}
        </div>
      </div>
      
      {/* Status badge */}
      <div className="mt-3 flex justify-end">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[status]}`}>
          {statusLabel[status]}
        </span>
      </div>
    </div>
  );
}