// useWorldCup hook - Fetch and cache World Cup standings/rounds
import { useEffect, useCallback, useRef, useState } from 'react';
import useAppStore from '../store/useAppStore.js';
// Importar directamente para evitar problemas con el lazy import del adapter
import { getStandings, getRounds } from '../api/apiFootball.js';

const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const LEAGUE_ID = 1; // API-Football World Cup league ID
const SEASON = 2026;

/**
 * Check if fetched data is still fresh
 * @param {Object} data - Data with lastFetched timestamp
 * @returns {boolean}
 */
function isFresh(data) {
  if (!data || !data.lastFetched) return false;
  return Date.now() - data.lastFetched < STALE_TIMEOUT;
}

export function useWorldCup() {
  const {
    wcStandings,
    wcRounds,
    setWcStandings,
    setWcRounds,
  } = useAppStore();

  const loadingRef = useRef(false);
  const [loading, setLoadingState] = useState(false);
  const [error, setErrorState] = useState(null);

  const fetchData = useCallback(async (force = false) => {
    // Check if fresh data exists (skip if not forced)
    if (!force && isFresh(wcStandings)) {
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadingState(true);
    setErrorState(null);

    try {
      const [standingsData, roundsData] = await Promise.all([
        getStandings(LEAGUE_ID, SEASON),
        getRounds(LEAGUE_ID, SEASON),
      ]);

      if (standingsData && standingsData.length > 0) {
        setWcStandings({
          groups: standingsData,
          lastFetched: Date.now(),
        });
        setWcRounds(roundsData);
      } else {
        setErrorState('No se pudieron cargar las posiciones. Verificá la conexión con la API.');
      }
    } catch (err) {
      console.error('[useWorldCup] Error fetching World Cup data:', err);
      setErrorState(err.message || 'Error al cargar datos del Mundial');
    } finally {
      loadingRef.current = false;
      setLoadingState(false);
    }
  }, [wcStandings, setWcStandings, setWcRounds]);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Expose standings groups directly for convenience
  const standings = wcStandings?.groups || null;
  const rounds = wcRounds;

  return {
    standings,
    rounds,
    loading,
    error,
    refetch,
  };
}

export default useWorldCup;
