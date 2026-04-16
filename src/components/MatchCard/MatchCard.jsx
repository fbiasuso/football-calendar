// MatchCard component - Individual match display
import { useState } from 'react';
import { formatTime } from '../../utils/dateUtils.js';
import { getMatchById, findFirstLegMatch } from '../../api/adapter.js';

// Knockout stages that have two-legged ties
const KNOCKOUT_STAGES = ['ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

export default function MatchCard({ match }) {
  const { teams, status, league, date, score, stage, matchday, leagueId, season } = match;
  const [aggregateScore, setAggregateScore] = useState(null);
  const [loadingAggregate, setLoadingAggregate] = useState(false);
  
  const homeTeam = teams?.home || { name: 'N/A', badge: '' };
  const awayTeam = teams?.away || { name: 'N/A', badge: '' };
  
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    live: 'bg-red-500 text-white animate-pulse',
    finished: 'bg-gray-200 text-gray-600',
  };
  
  const showScore = score?.home != null && score?.away != null;
  
  // Only show "Ver Global" for knockout stages (not group stages)
  const isKnockoutMatch = KNOCKOUT_STAGES.includes(stage) && status === 'finished';
  
  const handleShowAggregate = async () => {
    if (aggregateScore !== null) {
      setAggregateScore(null);
      return;
    }
    
    setLoadingAggregate(true);
    try {
      // Get current match details
      const matchDetails = await getMatchById(match.id);
      
      // Try to find the first leg
      const firstLegScore = await findFirstLegMatch({
        homeTeam: { id: matchDetails.homeTeam?.id },
        awayTeam: { id: matchDetails.awayTeam?.id },
        competition: { id: matchDetails.competition?.id },
        season: { id: matchDetails.season?.id },
        utcDate: matchDetails.utcDate,
      });
      
      // Calculate aggregate: first leg + current leg
      // Note: current match might be away or home, need to handle accordingly
      if (firstLegScore) {
        setAggregateScore({
          home: firstLegScore.home + (score?.home ?? 0),
          away: firstLegScore.away + (score?.away ?? 0),
        });
      } else {
        // No first leg found - need more complex lookup
        console.log('First leg not found');
      }
    } catch (error) {
      console.error('Error fetching aggregate:', error);
    } finally {
      setLoadingAggregate(false);
    }
  };
  
  // Only display aggregate if it actually exists and is different from main score
  const displayAggregate = aggregateScore && 
    (aggregateScore.home !== score?.home || aggregateScore.away !== score?.away);
  
  const showScore = score?.home != null && score?.away != null;
  
  // Only show "Ver Global" for knockout stages (not group stages)
  // And only if we actually have aggregate data to show
  const isKnockoutMatch = KNOCKOUT_STAGES.includes(stage) && status === 'finished';
  
  // Only display aggregate if it actually exists (different from main score)
  const displayAggregate = aggregateScore && 
    (aggregateScore.home !== score?.home || aggregateScore.away !== score?.away);
  
  const handleShowAggregate = async () => {
    if (aggregateScore !== null) {
      setAggregateScore(null);
      return;
    }
    
    setLoadingAggregate(true);
    try {
      // Fetch full match details to get extraTime/penalties (aggregate)
      const matchDetails = await getMatchById(match.id);
      
      const extraTime = matchDetails?.score?.extraTime;
      const penalties = matchDetails?.score?.penalties;
      
      // Only show if there's actual extraTime or penalties data (not just fullTime)
      if (extraTime?.home != null || penalties?.home != null) {
        setAggregateScore({
          home: extraTime?.home ?? penalties?.home,
          away: extraTime?.away ?? penalties?.away,
        });
      } else {
        // No extra aggregate data available - hide button or show message
        console.log('No aggregate data available for this match');
      }
    } catch (error) {
      console.error('Error fetching aggregate:', error);
    } finally {
      setLoadingAggregate(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="text-xs font-medium text-gray-500 mb-2">
        {league} {matchday && `#${matchday}`}
      </div>
      
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
          {displayAggregate && (
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
        
        <div className="flex items-center gap-2">
          {/* Botón "Ver Global" solo para partidos de eliminación directa */}
          {isKnockoutMatch && (
            <button
              onClick={handleShowAggregate}
              disabled={loadingAggregate}
              className="text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
            >
              {loadingAggregate ? '...' : aggregateScore ? 'Ocultar' : 'Ver Global'}
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