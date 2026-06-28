// useMatches hook - Fetch, cache, and polling for matches
import { useEffect, useCallback, useRef } from 'react';
import useAppStore from '../store/useAppStore.js';
import { supabase } from '../lib/supabase.js';
import { getDateKey } from '../utils/dateUtils.js';

const useSupabase = !!import.meta.env.VITE_SUPABASE_URL;

const CACHE_PREFIX = 'fc_matches_';
const CACHE_EXPIRY = 60 * 60 * 1000; // 60 minutes cache for finished/pending matches

/**
 * Get cache key for a date
 */
function getCacheKey(date) {
  return CACHE_PREFIX + getDateKey(date);
}

/**
 * Get matches from localStorage cache
 */
function getCachedMatches(date) {
  try {
    const key = getCacheKey(date);
    const cached = localStorage.getItem(key);
    
    if (cached) {
      const { matches, timestamp } = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return { matches, timestamp };
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }
  
  return null;
}

/**
 * Save matches to localStorage cache
 */
function setCachedMatches(date, matches) {
  try {
    const key = getCacheKey(date);
    const data = {
      matches,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Cache write error:', error);
  }
}

/**
 * Check if any match is in the last 5 minutes
 */
function hasMatchInLast5Minutes(matches) {
  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  
  return matches.some(m => 
    m.status === 'live' && 
    m.date < now && 
    m.date > fiveMinAgo
  );
}

export function useMatches() {
  const {
    matches,
    selectedDate,
    isLoading,
    error,
    autoPollingEnabled,
    fetchMatches,
    setMatches,
    setError,
  } = useAppStore();
  
  const pollingIntervalRef = useRef(null);
  const unsubscribeRef = useRef(null);
  
  // Fetch matches (with cache)
  const loadMatches = useCallback(async (forceRefresh = false) => {
    // Skip cache if Supabase is active (Realtime provides live updates)
    if (!useSupabase && !forceRefresh) {
      const cached = getCachedMatches(selectedDate);
      if (cached) {
        setMatches(cached.matches, cached.timestamp);
        return;
      }
    }
    
    try {
      await fetchMatches();
      
      // Cache the results if we have matches
      const storeMatches = useAppStore.getState().matches;
      if (storeMatches.length > 0) {
        // Don't cache dates with live matches — prevents stale live data
        const hasLiveMatch = storeMatches.some(m => m.status === 'live');
        if (!hasLiveMatch) {
          setCachedMatches(selectedDate, storeMatches);
        }
      }
    } catch (error) {
      console.error('Error loading matches:', error);
    }
  }, [selectedDate, fetchMatches, setMatches]);
  
  // Manual refresh (bypass cache)
  const refresh = useCallback(async () => {
    // Clear cache for current date
    const key = getCacheKey(selectedDate);
    localStorage.removeItem(key);
    
    // Fetch fresh data
    await loadMatches(true);
  }, [selectedDate, loadMatches]);
  
  // Auto-polling (legacy, only without Supabase)
  useEffect(() => {
    if (useSupabase) return; // Realtime replaces polling
    if (autoPollingEnabled && matches.some(m => m.status === 'live')) {
      // Determine polling interval
      const interval = hasMatchInLast5Minutes(matches) 
        ? 60 * 1000  // 1 minute if in last 5 min
        : 5 * 60 * 1000; // 5 minutes otherwise
      
      pollingIntervalRef.current = setInterval(() => {
        loadMatches(true);
      }, interval);
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [autoPollingEnabled, matches, loadMatches, useSupabase]);
  
  // Initial load
  useEffect(() => {
    loadMatches();
  }, [loadMatches]);
  
  // Realtime subscription (Supabase mode only)
  useEffect(() => {
    if (!useSupabase) return;

    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Import dynamically to avoid circular dependency
    import('../api/supabaseAdapter.js').then(({ subscribeMatches }) => {
      unsubscribeRef.current = subscribeMatches(selectedDate, (updatedMatch) => {
        const state = useAppStore.getState();
        const currentMatches = state.matches;
        const idx = currentMatches.findIndex(m => m.id === updatedMatch.id);

        let newMatches;
        if (idx >= 0) {
          // Merge only fields Realtime can provide reliably (no team/league joins)
          newMatches = [...currentMatches];
          newMatches[idx] = {
            ...newMatches[idx],
            status: updatedMatch.status,
            score: updatedMatch.score,
            minute: updatedMatch.minute,
          };
        } else if (updatedMatch.status !== 'finished' && updatedMatch.date >= new Date(selectedDate).getTime()) {
          // New match appeared in our date range (only if not finished)
          newMatches = [...currentMatches, updatedMatch];
        } else {
          return; // No update needed
        }

        state.setMatches(newMatches, state.lastUpdated);
      });
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [selectedDate, useSupabase]);
  
  const hasLiveMatches = matches.some(m => m.status === 'live');

  return {
    matches,
    isLoading,
    error,
    refresh,
    hasLiveMatches,
  };
}

export default useMatches;