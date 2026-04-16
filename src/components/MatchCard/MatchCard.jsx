// MatchCard component - Individual match display
import { useState } from 'react';
import { formatTime } from '../../utils/dateUtils.js';
import { getMatchById } from '../../api/adapter.js';

// Leagues that typically have two-legged ties
const KNOCKOUT_LEAGUES = ['UEFA Champions League', 'Copa Libertadores', 'Copa Sudamericana'];

export default function MatchCard({ match }) {
  const { teams, status, league, date, score } = match;
  const [showAggregate, setShowAggregate] = useState(null);
  const [loadingAggregate, setLoadingAggregate] = useState(false);
  
  const homeTeam = teams?.home || { name: 'N/A', badge: '' };
  const awayTeam = teams?.away || { name: 'N/A', badge: '' };
  
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    live: 'bg-red-500 text-white animate-pulse',
    finished: 'bg-gray-200 text-gray-600',
  };
  
  const showScore = score?.home != null && score?.away != null;
  
  // Only show "Ver Global" for finished knockout matches
  const isKnockoutMatch = KNOCKOUT_LEAGUES.some(l => league?.includes(l)) && status === 'finished';
  
  const handleShowAggregate = async () => {
    if (showAggregate !== null) {
      setShowAggregate(null);
      return;
    }
    
    setLoadingAggregate(true);
    try {
      const matchDetails = await getMatchById(match.id);
      const agg = matchDetails?.aggregateScore;
      setShowAggregate(agg);
    } catch (error) {
      console.error('Error fetching aggregate:', error);
    } finally {
      setLoadingAggregate(false);
    }
  };
  
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
          {showAggregate && (
            <span className="text-xs text-gray-400 mt-0.5">
              ({showAggregate.home} - {showAggregate.away})
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
        
        <div className="flex items-center gap-2">
          {/* Botón "Ver Global" para partidos de ida/vuelta */}
          {isKnockoutMatch && (
            <button
              onClick={handleShowAggregate}
              disabled={loadingAggregate}
              className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {loadingAggregate ? '...' : showAggregate ? 'Ocultar' : 'Ver Global'}
            </button>
          )}
          
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}`}>
            {status === 'pending' ? formatTime(date) : status === 'live' ? 'EN VIVO' : 'FINALIZADO'}
          </span>
        </div>
      </div>
    </div>
  );
}