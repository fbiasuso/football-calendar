// Schedule adaptativo para data pipeline
// Port of scripts/schedule.js to Deno/TypeScript
// Función pura — no tiene efectos secundarios, no importa red ni filesystem.

export interface Match {
  id: string;
  date: number; // Unix ms
  status: "pending" | "live" | "finished";
}

export interface ScheduleOptions {
  now: Date;
  knownFixtures?: Match[];
  mode?: "worldcup" | "leagues";
  lastFetched?: Date | null;
  meta?: { nextPlanned?: string } | null;
  fastMode?: boolean;
}

export interface ScheduleDecision {
  shouldFetch: boolean;
  reasons: string[];
  nextPlanned: Date;
  endpoints: string[];
}

const WORLD_CUP_START = new Date("2026-06-20T00:00:00-03:00");
const WORLD_CUP_END = new Date("2026-07-20T23:59:59-03:00");

/**
 * Check if current date falls within World Cup period.
 */
export function isWorldCupPeriod(now: Date): boolean {
  return now >= WORLD_CUP_START && now <= WORLD_CUP_END;
}

/**
 * Get Argentina hour (ART = UTC-3) from a Date object.
 */
function getArtHour(date: Date): number {
  return (date.getUTCHours() - 3 + 24) % 24;
}

/**
 * Check if there are any live matches in the known fixtures.
 */
function hasLiveMatches(knownFixtures: Match[]): boolean {
  if (!knownFixtures || !Array.isArray(knownFixtures)) return false;
  return knownFixtures.some((m) => m && m.status === "live");
}

/**
 * Get the next pending match time from known fixtures.
 */
function getNextMatchTime(knownFixtures: Match[], now: Date): Date | null {
  if (!knownFixtures || !Array.isArray(knownFixtures)) return null;

  const nowMs = now.getTime();
  const futureMatches = knownFixtures
    .filter((m) => m && m.status === "pending" && m.date > nowMs)
    .sort((a, b) => a.date - b.date);

  if (futureMatches.length === 0) return null;
  return new Date(futureMatches[0].date);
}

/**
 * Get the next window opening time in ART for a given mode.
 */
function getNextWindowOpening(mode: "worldcup" | "leagues", now: Date): Date {
  const artHour = getArtHour(now);
  const openingHour = mode === "worldcup" ? 12 : 8;

  const candidate = new Date(now);
  candidate.setUTCHours(openingHour + 3, 0, 0, 0); // ART → UTC = +3h
  if (now >= candidate) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

/**
 * Get schedule decision: should we fetch, and what endpoints?
 *
 * Port of scripts/schedule.js → getSchedule()
 */
export function getSchedule(options: ScheduleOptions): ScheduleDecision {
  const { now, knownFixtures = [], mode, lastFetched, meta } = options;
  const reasons: string[] = [];
  const endpoints: string[] = [];

  // Determine mode
  const resolvedMode = mode ||
    (isWorldCupPeriod(now) ? "worldcup" : "leagues");
  const artHour = getArtHour(now);
  const hasLive = hasLiveMatches(knownFixtures);
  const nextMatch = getNextMatchTime(knownFixtures, now);

  // --- nextPlanned check ---
  if (meta?.nextPlanned) {
    const planned = new Date(meta.nextPlanned);
    if (now < planned) {
      const diffMin = Math.round(
        (planned.getTime() - now.getTime()) / 60000,
      );
      reasons.push(
        `antes del próximo fetch planificado (en ${diffMin} min)`,
      );
      return {
        shouldFetch: false,
        reasons,
        nextPlanned: planned,
        endpoints: [],
      };
    }
  }

  // Fast mode: fetch live matches every 5 min
  if (options.fastMode) {
    const lastFetchTime = options.lastFetched ? new Date(options.lastFetched) : null;
    const minutesSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / 60000
      : 99;

    if (minutesSinceLastFetch >= 5) {
      reasons.push("fast_mode: every 5 min live check");
      endpoints.push("live");
      return {
        shouldFetch: true,
        reasons,
        nextPlanned: new Date(now.getTime() + 5 * 60 * 1000),
        endpoints,
      };
    }

    reasons.push(`fast_mode: last fetch ${Math.round(minutesSinceLastFetch)} min ago → skip`);
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: new Date(now.getTime() + 5 * 60 * 1000),
      endpoints: [],
    };
  }

  // --- Off-hours schedule refresh (both modes) ---
  if (artHour >= 4 && artHour <= 6) {
    const lastFetchTime = lastFetched ? new Date(lastFetched) : null;
    const lastFetchDay = lastFetchTime ? lastFetchTime.getDate() : -1;
    const today = now.getDate();

    if (lastFetchDay !== today || !lastFetchTime) {
      reasons.push("off-hours schedule refresh");
      endpoints.push("fixtures");
      return {
        shouldFetch: true,
        reasons,
        nextPlanned: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        endpoints,
      };
    }

    reasons.push("off-hours, already fetched today");
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: new Date(now.getTime() + 60 * 60 * 1000),
      endpoints: [],
    };
  }

  if (resolvedMode === "worldcup") {
    // --- World Cup mode ---
    // Active window: 12:00 to 02:00 (+1 day) ART
    const inWindow = artHour >= 12 || artHour < 2;

    if (!inWindow) {
      const nextWindow = getNextWindowOpening("worldcup", now);
      reasons.push(
        `fuera de ventana activa (${artHour}:00 ART), próxima ventana: ${nextWindow.toISOString()}`,
      );
      return {
        shouldFetch: false,
        reasons,
        nextPlanned: nextWindow,
        endpoints: [],
      };
    }

    // In active window
    if (knownFixtures && knownFixtures.length > 0) {
      if (hasLive) {
        reasons.push("worldcup: live match → 15min interval");
        endpoints.push("fixtures", "live", "standings");
        return {
          shouldFetch: true,
          reasons,
          nextPlanned: new Date(now.getTime() + 15 * 60 * 1000),
          endpoints,
        };
      }

      if (
        nextMatch &&
        (nextMatch.getTime() - now.getTime()) < 2 * 60 * 60 * 1000
      ) {
        reasons.push("worldcup: próximo partido < 2h → 30min interval");
        endpoints.push("fixtures");
        return {
          shouldFetch: true,
          reasons,
          nextPlanned: new Date(now.getTime() + 30 * 60 * 1000),
          endpoints,
        };
      }
    }

    // Default: every 2h
    const lastFetchTime = lastFetched ? new Date(lastFetched) : null;
    const hoursSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / (60 * 60 * 1000)
      : 99;

    if (hoursSinceLastFetch < 2) {
      reasons.push(
        `worldcup: default 2h interval, last fetch ${hoursSinceLastFetch.toFixed(1)}h ago → skip`,
      );
      return {
        shouldFetch: false,
        reasons,
        nextPlanned: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        endpoints: [],
      };
    }

    reasons.push("worldcup: default → 2h interval");
    endpoints.push("fixtures");
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
    const nextWindow = getNextWindowOpening("leagues", now);
    reasons.push(
      `fuera de ventana activa (${artHour}:00 ART), próxima ventana: ${nextWindow.toISOString()}`,
    );
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: nextWindow,
      endpoints: [],
    };
  }

  // In active window, no fixtures
  if (!knownFixtures || knownFixtures.length === 0) {
    const lastFetchTime = lastFetched ? new Date(lastFetched) : null;
    const hoursSinceLastFetch = lastFetchTime
      ? (now.getTime() - lastFetchTime.getTime()) / (60 * 60 * 1000)
      : 99;

    if (hoursSinceLastFetch >= 4) {
      reasons.push("leagues: no fixtures, 4h interval elapsed → checking");
      endpoints.push("fixtures");
      return {
        shouldFetch: true,
        reasons,
        nextPlanned: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        endpoints,
      };
    }

    reasons.push(
      `leagues: no fixtures, last fetch ${hoursSinceLastFetch.toFixed(1)}h ago`,
    );
    return {
      shouldFetch: false,
      reasons,
      nextPlanned: new Date(now.getTime() + 60 * 60 * 1000),
      endpoints: [],
    };
  }

  // Have fixtures
  if (hasLive) {
    reasons.push("leagues: live match → 15min interval");
    endpoints.push("fixtures", "live");
    return {
      shouldFetch: true,
      reasons,
      nextPlanned: new Date(now.getTime() + 15 * 60 * 1000),
      endpoints,
    };
  }

  // Default active window: every 30 min
  reasons.push("leagues: default active → 30min interval");
  endpoints.push("fixtures");
  return {
    shouldFetch: true,
    reasons,
    nextPlanned: new Date(now.getTime() + 30 * 60 * 1000),
    endpoints,
  };
}
