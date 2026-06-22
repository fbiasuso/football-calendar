// Schedule adaptativo para data pipeline
// Decide si ejecutar un fetch según hora actual, modo operativo y partidos conocidos.
// Función pura — no tiene efectos secundarios, no importa red ni filesystem.

const WORLD_CUP_START = new Date('2026-06-20T00:00:00-03:00'); // 20-jun ART
const WORLD_CUP_END   = new Date('2026-07-20T23:59:59-03:00'); // 20-jul ART

/**
 * Check if current date falls within World Cup period
 * @param {Date} now
 * @returns {boolean}
 */
export function isWorldCupPeriod(now) {
  return now >= WORLD_CUP_START && now <= WORLD_CUP_END;
}

/**
 * Get Argentina hour from a Date object
 * @param {Date} date
 * @returns {number} Hour in ART (UTC-3), 0-23
 */
function getArtHour(date) {
  return (date.getUTCHours() - 3 + 24) % 24;
}

/**
 * Check if there are any live matches in the known fixtures
 * @param {Array} knownFixtures
 * @returns {boolean}
 */
function hasLiveMatches(knownFixtures) {
  if (!knownFixtures || !Array.isArray(knownFixtures)) return false;
  return knownFixtures.some(m => m && m.status === 'live');
}

/**
 * Get the next match time from known fixtures
 * @param {Array} knownFixtures
 * @param {Date} now
 * @returns {Date|null} Date of next pending match, or null
 */
function getNextMatchTime(knownFixtures, now) {
  if (!knownFixtures || !Array.isArray(knownFixtures)) return null;

  const nowMs = now.getTime();
  const futureMatches = knownFixtures
    .filter(m => m && m.status === 'pending' && m.date > nowMs)
    .sort((a, b) => a.date - b.date);

  if (futureMatches.length === 0) return null;
  return new Date(futureMatches[0].date);
}

/**
 * Get schedule decision: should we fetch, and what endpoints?
 *
 * @param {Object} options
 * @param {Date} options.now - Current time
 * @param {Array} [options.knownFixtures] - Array of normalized Match objects
 * @param {'worldcup'|'leagues'} [options.mode] - If not provided, auto-detect
 * @param {Date|null} [options.lastFetched] - When we last fetched
 * @param {Object} [options.meta] - Previous meta.json content
 * @returns {{ shouldFetch: boolean, reasons: string[], nextPlanned: Date, endpoints: string[] }}
 */
/**
 * Get the next window opening time in ART for a given mode.
 * Outside-window skips set nextPlanned to this time so the scheduler
 * advances reliably toward the next active period.
 * @param {'worldcup'|'leagues'} mode
 * @param {Date} now
 * @returns {Date}
 */
function getNextWindowOpening(mode, now) {
  const artHour = getArtHour(now);
  let openingHour;
  if (mode === 'worldcup') {
    // World Cup: 12:00 ART
    openingHour = 12;
  } else {
    // Leagues: 08:00 ART
    openingHour = 8;
  }

  // If we're already past openingHour today, next opening is tomorrow
  const candidate = new Date(now);
  candidate.setUTCHours(openingHour + 3, 0, 0, 0); // ART→UTC = +3h
  if (now >= candidate) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

export function getSchedule({ now, knownFixtures = [], mode, lastFetched, meta }) {
  const reasons = [];
  const endpoints = [];

  // Determine mode
  const resolvedMode = mode || (isWorldCupPeriod(now) ? 'worldcup' : 'leagues');
  const artHour = getArtHour(now);
  const hasLive = hasLiveMatches(knownFixtures);
  const nextMatch = getNextMatchTime(knownFixtures, now);

  // --- nextPlanned check (skip if not yet due) ---
  // The previous run stores nextPlanned in meta.json so subsequent runs
  // don't over-fetch when cron triggers faster than the intended interval.
  if (meta?.nextPlanned) {
    const planned = new Date(meta.nextPlanned);
    if (now < planned) {
      const diffMin = Math.round((planned.getTime() - now.getTime()) / 60000);
      reasons.push(`antes del próximo fetch planificado (en ${diffMin} min)`);
      return {
        shouldFetch: false,
        reasons,
        nextPlanned: planned,
        endpoints: [],
      };
    }
  }

  // --- Off-hours schedule refresh (both modes) ---
  // Between 4:00 and 6:00 AM ART, do one daily schedule refresh
  if (artHour >= 4 && artHour <= 6) {
    // Only do schedule refresh if we haven't already done one today
    const lastFetchTime = lastFetched ? new Date(lastFetched) : null;
    const lastFetchDay = lastFetchTime ? lastFetchTime.getDate() : -1;
    const today = now.getDate();

    if (lastFetchDay !== today || !lastFetchTime) {
      reasons.push('off-hours schedule refresh');
      endpoints.push('fixtures');
      return {
        shouldFetch: true,
        reasons,
        nextPlanned: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow same time
        endpoints,
      };
    }

    reasons.push(`off-hours, already fetched today`);
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: new Date(now.getTime() + 60 * 60 * 1000), // Check again in 1h
      endpoints: [],
    };
  }

  if (resolvedMode === 'worldcup') {
    // --- World Cup mode ---
    // Active window: 12:00 to 02:00 (+1 day) ART
    const inWindow = artHour >= 12 || artHour < 2;

    if (!inWindow) {
      // Outside active window (2:00-11:59) — skip (off-hours handled above)
      const nextWindow = getNextWindowOpening('worldcup', now);
      reasons.push(`fuera de ventana activa (${artHour}:00 ART), próxima ventana: ${nextWindow.toISOString()}`);
      return {
        shouldFetch: false,
        reasons,
        nextPlanned: nextWindow,
        endpoints: [],
      };
    }

    // In active window: if we have fixtures, use match-aware intervals
    if (knownFixtures && knownFixtures.length > 0) {
      if (hasLive) {
        reasons.push('worldcup: live match → 15min interval');
        endpoints.push('fixtures', 'live');
        if (endpoints.indexOf('standings') === -1) endpoints.push('standings');
        return {
          shouldFetch: true,
          reasons,
          nextPlanned: new Date(now.getTime() + 15 * 60 * 1000),
          endpoints,
        };
      }

      if (nextMatch && (nextMatch.getTime() - now.getTime()) < 2 * 60 * 60 * 1000) {
        reasons.push('worldcup: próximo partido < 2h → 30min interval');
        endpoints.push('fixtures');
        return {
          shouldFetch: true,
          reasons,
          nextPlanned: new Date(now.getTime() + 30 * 60 * 1000),
          endpoints,
        };
      }
    }

    // Default: every 2h (also covers the "no local fixtures" case)
    reasons.push('worldcup: default → 2h interval');
    endpoints.push('fixtures');
    return {
      shouldFetch: true,
      reasons,
      nextPlanned: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endpoints,
    };
  }

  // --- Leagues mode ---
  // Active window: 08:00 to 01:00 (+1 day) ART
  const inWindow = artHour >= 8 || artHour < 1;

  if (!inWindow) {
    // Outside active window (2:00-7:59) — skip (off-hours handled above)
    const nextWindow = getNextWindowOpening('leagues', now);
    reasons.push(`fuera de ventana activa (${artHour}:00 ART), próxima ventana: ${nextWindow.toISOString()}`);
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: nextWindow,
      endpoints: [],
    };
  }

  // In active window
  if (!knownFixtures || knownFixtures.length === 0) {
    // No fixtures known — check every 4h to see if new fixtures appeared
    const lastFetchTime = lastFetched ? new Date(lastFetched) : null;
    const hoursSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / (60 * 60 * 1000)
      : 99;

    if (hoursSinceLastFetch >= 4) {
      reasons.push('leagues: no fixtures, 4h interval elapsed → checking');
      endpoints.push('fixtures');
      return {
        shouldFetch: true,
        reasons,
        nextPlanned: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        endpoints,
      };
    }

    reasons.push(`leagues: no fixtures, last fetch ${hoursSinceLastFetch.toFixed(1)}h ago`);
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: new Date(now.getTime() + 60 * 60 * 1000),
      endpoints: [],
    };
  }

  // Have fixtures
  if (hasLive) {
    reasons.push('leagues: live match → 15min interval');
    endpoints.push('fixtures', 'live');
    return {
      shouldFetch: true,
      reasons,
      nextPlanned: new Date(now.getTime() + 15 * 60 * 1000),
      endpoints,
    };
  }

  // Default active window: every 30 min
  reasons.push('leagues: default active → 30min interval');
  endpoints.push('fixtures');
  return {
    shouldFetch: true,
    reasons,
    nextPlanned: new Date(now.getTime() + 30 * 60 * 1000),
    endpoints,
  };
}
