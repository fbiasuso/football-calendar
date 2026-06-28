// football-data.org v4 API Client for Deno Edge Function
// Documentation: https://www.football-data.org/documentation
// Uses native fetch with retry logic.

const API_BASE_URL = "https://api.football-data.org/v4";

// ── Request Counter (no-op — football-data.org uses rate limiting, not daily budget) ─

let _requestCount = 0;

export function getRequestCount(): number {
  return _requestCount;
}

export function resetRequestCount(): void {
  _requestCount = 0;
}

// ── Internal League ID Mapper ───────────────────────────────────────────────

// Maps our internal league IDs → football-data.org competition IDs
const INTERNAL_TO_EXTERNAL: Record<number, number> = {
  1: 2000,  // World Cup 2026
  2: 2001,  // UEFA Champions League
  3: 2021,  // Premier League
  4: 2014,  // LaLiga
  5: 2002,  // Bundesliga
  6: 2019,  // Serie A
  7: 2055,  // FA Cup
  8: 2079,  // Copa del Rey
  9: 2011,  // DFB-Pokal
  10: 2122, // Coppa Italia
  11: 2139, // EFL Cup
  12: 2152, // Copa Libertadores
  13: 2024, // Argentine Liga Profesional
};

// Reverse map: external → internal
const EXTERNAL_TO_INTERNAL: Record<number, number> = {};
for (const [internal, external] of Object.entries(INTERNAL_TO_EXTERNAL)) {
  EXTERNAL_TO_INTERNAL[external] = Number(internal);
}

// League display names keyed by internal ID
const LEAGUE_NAMES: Record<number, string> = {
  1: "World Cup 2026",
  2: "UEFA Champions League",
  3: "Premier League",
  4: "LaLiga",
  5: "Bundesliga",
  6: "Serie A",
  7: "FA Cup",
  8: "Copa del Rey",
  9: "DFB-Pokal",
  10: "Coppa Italia",
  11: "EFL Cup",
  12: "Copa Libertadores",
  13: "Argentine Liga Profesional",
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiTeam {
  name: string;
  badge: string;
  id: number;
}

export interface ApiMatch {
  id: string;
  date: number; // Unix ms
  league: string;
  leagueId: number;
  teams: {
    home: ApiTeam;
    away: ApiTeam;
  };
  status: "pending" | "live" | "finished";
  score: {
    home: number | null;
    away: number | null;
  };
  minute: number | null;
  round: string | null;
  isKnockout: boolean;
  season: number | null;
}

export interface StandingTeam {
  rank: number;
  name: string;
  logo: string;
  teamId: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
}

export interface StandingsGroup {
  group: string;
  teams: StandingTeam[];
}

// ── Retry Logic ──────────────────────────────────────────────────────────────

/**
 * Fetch with exponential backoff retry.
 * 3 retries, 1s base delay.
 */
export async function fetchWithRetry(
  endpoint: string,
  retries = 0,
): Promise<any> {
  const apiKey = Deno.env.get("VITE_FOOTBALL_API_KEY");
  if (!apiKey) {
    throw new Error("VITE_FOOTBALL_API_KEY not configured");
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "X-Auth-Token": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retries + 1))
        );
        return fetchWithRetry(endpoint, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (retries < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry(endpoint, retries + 1);
    }
    throw error;
  }
}

// ── Normalization ────────────────────────────────────────────────────────────

/**
 * Map football-data.org status codes to internal status.
 */
export function mapStatus(
  apiStatus: string,
): "pending" | "live" | "finished" {
  const statusMap: Record<string, "pending" | "live" | "finished"> = {
    "SCHEDULED": "pending",
    "TIMED": "pending",
    "IN_PLAY": "live",
    "PAUSED": "live",
    "LIVE": "live",
    "FINISHED": "finished",
    "POSTPONED": "pending",
    "CANCELLED": "finished",
    "SUSPENDED": "live",
  };
  return statusMap[apiStatus] || "pending";
}

/**
 * Detect if a round/stage indicates a knockout round.
 */
export function isKnockoutRound(stage: string | null): boolean {
  if (!stage) return false;
  return /Round of 16|Quarter|Semi|Final/i.test(stage.replace(/_/g, " "));
}

/**
 * Normalize a football-data.org match to the agnostic ApiMatch interface.
 */
export function normalizeMatch(match: any): ApiMatch {
  const homeTeam = match.homeTeam || {};
  const awayTeam = match.awayTeam || {};
  const score = match.score || {};
  const competition = match.competition || {};

  const externalId = competition.id;
  const internalId = EXTERNAL_TO_INTERNAL[externalId];
  const leagueName = internalId ? (LEAGUE_NAMES[internalId] || "Otros") : "Otros";

  return {
    id: String(match.id),
    date: new Date(match.utcDate).getTime(),
    league: leagueName,
    leagueId: internalId || externalId,
    teams: {
      home: {
        name: homeTeam.name || "N/A",
        badge: homeTeam.crest || "",
        id: homeTeam.id,
      },
      away: {
        name: awayTeam.name || "N/A",
        badge: awayTeam.crest || "",
        id: awayTeam.id,
      },
    },
    status: mapStatus(match.status),
    score: {
      home: score.fullTime?.home ?? (score.home ?? null),
      away: score.fullTime?.away ?? (score.away ?? null),
    },
    minute: match.matchMinutes || null,
    round: match.stage || null,
    isKnockout: isKnockoutRound(match.stage),
    season: match.season?.id ? Number(match.season.id) : null,
  };
}

/**
 * Check if a match's competition is in our supported league set.
 */
function isSupportedMatch(match: any): boolean {
  const externalId = match.competition?.id;
  return externalId !== undefined && EXTERNAL_TO_INTERNAL[externalId] !== undefined;
}

/**
 * Format a Date as YYYY-MM-DD using local timezone methods.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalize standings response to per-group structure.
 *
 * football-data.org returns standings in the format:
 *   data.standings[].{ group: "GROUP_A", table: [{ position, team: {id,name,crest}, ... }] }
 */
export function normalizeStandings(data: any): StandingsGroup[] {
  const standings = data?.standings || [];
  if (!Array.isArray(standings)) return [];

  return standings.map((groupStandings: any) => {
    // Extract group letter from "GROUP_A" → "A" or "Group A" → "A"
    let group = groupStandings.group || "";
    if (group.startsWith("GROUP_")) {
      group = group.replace("GROUP_", "");
    } else if (group.startsWith("Group ")) {
      group = group.replace("Group ", "");
    }

    const table = Array.isArray(groupStandings.table) ? groupStandings.table : [];

    return {
      group,
      teams: table.map((entry: any) => {
        const team = entry.team || {};
        return {
          rank: entry.position ?? 0,
          name: team.name || "N/A",
          logo: team.crest || "",
          teamId: team.id,
          points: entry.points ?? 0,
          played: entry.playedGames ?? 0,
          wins: entry.won ?? 0,
          draws: entry.draw ?? 0,
          losses: entry.lost ?? 0,
          goalsFor: entry.goalsFor ?? 0,
          goalsAgainst: entry.goalsAgainst ?? 0,
          goalDiff: entry.goalDifference ?? 0,
        };
      }),
    };
  });
}

// ── API Methods ──────────────────────────────────────────────────────────────

/**
 * Get all matches for a specific LOCAL date.
 *
 * Queries football-data.org /matches endpoint with a date range,
 * then filters by our supported leagues (internal league IDs).
 */
export async function getMatches(date: string): Promise<ApiMatch[]> {
  const targetDate = new Date(date);

  // Fetch day before to day after to catch timezone edge cases
  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const dateFrom = formatLocalDate(prevDate);
  const dateTo = formatLocalDate(nextDate);

  const data = await fetchWithRetry(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  );

  const allMatches = data.matches || [];

  return allMatches
    .filter(isSupportedMatch)
    .map(normalizeMatch)
    .filter((match: ApiMatch) => {
      const matchDate = new Date(match.date);
      return matchDate.getFullYear() === targetDate.getFullYear() &&
        matchDate.getMonth() === targetDate.getMonth() &&
        matchDate.getDate() === targetDate.getDate();
    });
}

/**
 * Get all currently live matches.
 */
export async function getLiveMatches(): Promise<ApiMatch[]> {
  const data = await fetchWithRetry("/matches?status=LIVE");

  return (data.matches || [])
    .filter(isSupportedMatch)
    .map(normalizeMatch);
}

/**
 * Get standings for a league and season.
 *
 * @param leagueId - Our internal league ID (e.g. 1 for World Cup)
 * @param season - Season year (e.g. 2026)
 */
export async function getStandings(
  leagueId: number,
  season: number,
): Promise<StandingsGroup[]> {
  const externalId = INTERNAL_TO_EXTERNAL[leagueId];
  if (!externalId) {
    throw new Error(`No external ID mapping for internal league ID ${leagueId}`);
  }

  const data = await fetchWithRetry(
    `/competitions/${externalId}/standings`,
  );
  return normalizeStandings(data);
}
