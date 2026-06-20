// WorldCupPage - Container component for World Cup section
import { useMemo } from 'react';
import useAppStore from '../../store/useAppStore.js';
import { useWorldCup } from '../../hooks/useWorldCup.js';
import thirdPlaceRanker from './Bracket/thirdPlaceRanker.js';
import SubTabBar from './SubTabBar.jsx';
import GroupStandings from './GroupStandings/GroupStandings.jsx';
import Bracket from './Bracket/Bracket.jsx';

export default function WorldCupPage() {
  const { wcTab } = useAppStore();
  const { standings, loading, error, refetch } = useWorldCup();

  // Compute ranker result once, shared by GroupStandings (ThirdPlaceTable) and Bracket
  const rankerResult = useMemo(
    () => (standings && standings.length > 0 ? thirdPlaceRanker(standings) : null),
    [standings]
  );

  return (
    <div>
      <SubTabBar />

      {wcTab === 'grupos' && (
        <GroupStandings
          standings={standings}
          loading={loading}
          error={error}
          onRetry={refetch}
          rankerResult={rankerResult}
        />
      )}

      {wcTab === 'llaves' && (
        <Bracket
          standings={standings}
          loading={loading}
          rankerResult={rankerResult}
        />
      )}
    </div>
  );
}
