// MatchCard component - Individual match display
import { formatTime } from '../../utils/dateUtils.js';

export default function MatchCard({ match }) {
  const { teams, status, league, date, score, aggregateScore } = match;
  
  const homeTeam = teams?.home || { name: 'N/A', badge: '' };
  const awayTeam = teams?.away || { name: 'N/A', badge: '' };
  
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    live: 'bg-red-500 text-white animate-pulse',
    finished: 'bg-gray-200 text-gray-600',
  };
  
  const showScore = score?.home != null && score?.away != null;
  const showAggregate = aggregateScore?.home != null && aggregateScore?.away != null;
  
  // Determine if we should show aggregate (only for knockout stages with 2 legs)
  const isKnockoutWithAggregate = showAggregate && status === 'finished';
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="text-xs font-medium text-gray-500 mb-2">{league}</div>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {homeTeam.badge && (
            <img src={homeTeam.badge} alt="" className="w-6 h-6 flex-shrink-0" />
          )}
          <span className="font-semibold text-gray-900 text-sm truncate">{homeTeam.name}</span>
        </div>
        
        {/* Score display - main score and aggregate if applicable */}
        <div className="flex flex-col items-center min-w-[80px]">
          <span className="text-2xl font-bold text-gray-900">
            {showScore ? `${score.home} - ${score.away}` : 'vs'}
          </span>
          {isKnockoutWithAggregate && (
            <span className="text-xs text-gray-400 mt-0.5">
              ({aggregateScore.home} - {aggregateScore.away})
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <span className="font-semibold text-gray-900 text-sm truncate">{awayTeam.name}</span>
          {awayTeam.badge && (
            <img src={awayTeam.badge} alt="" className="w-6 h-6 flex-shrink-0" />
          )}
        </div>
      </div>
      
      <div className="mt-2 flex justify-between items-center">
        <span className="text-xs text-gray-500">{formatTime(date)}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}>
          {status === 'pending' ? formatTime(date) : status === 'live' ? 'EN VIVO' : 'FINALIZADO'}
        </span>
      </div>
    </div>
  );
}