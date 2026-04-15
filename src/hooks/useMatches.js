// useMatches hook - Fetch, cache, and polling for matches
import { useEffect, useCallback, useRef } from 'react';
import useAppStore from '../store/useAppStore.js';
import { getDateKey } from '../utils/dateUtils.js';

const CACHE_PREFIX = 'fc_matches_';
const CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

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
        return matches;
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
  
  // Fetch matches (with cache)
  const loadMatches = useCallback(async (forceRefresh = false) => {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedMatches(selectedDate);
      if (cached) {
        setMatches(cached);
        return;
      }
    }
    
    try {
      await fetchMatches();
      
      // Cache the results if we have matches
      const storeMatches = useAppStore.getState().matches;
      if (storeMatches.length > 0) {
        setCachedMatches(selectedDate, storeMatches);
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
  
  // Auto-polling logic
  useEffect(() => {
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
  }, [autoPollingEnabled, matches, loadMatches]);
  
  // Initial load
  useEffect(() => {
    loadMatches();
  }, [loadMatches]);
  
  return {
    matches,
    isLoading,
    error,
    refresh,
  };
}

export default useMatches;