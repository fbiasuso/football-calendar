// API-Football v3 Client for Deno Edge Function
// Port of scripts/lib/api.js
// Uses native fetch with retry logic.

const API_BASE_URL = "https://v3.football.api-sports.io";

// ── Request Counter ─────────────────────────────────────────────────────────

let _requestCount = 0;

export function getRequestCount(): number {
  return _requestCount;
}

export function resetRequestCount(): void {
  _requestCount = 0;
}

// Inline league IDs (matches src/utils/leagueConfig.js)
const API_FOOTBALL_LEAGUE_IDS: Record<string, number> = {
  "World Cup 2026": 1,
  "UEFA Champions League": 2,
  "Copa Libertadores": 13,
  "Copa Sudamericana": 11,
  "Premier League": 39,
  "FA Cup": 45,
  "EFL Cup": 48,
  "LaLiga": 140,
  "Copa del Rey": 143,
  "Supercopa": 556,
  "Serie A": 135,
  "Coppa Italia": 137,
  "Bundesliga": 78,
  "DFB-Pokal": 81,
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
  const apiKey = Deno.env.get("VITE_API_FOOTBALL_API_KEY");
  if (!apiKey) {
    throw new Error("VITE_API_FOOTBALL_API_KEY not configured");
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < 3) {
        _requestCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * (retries + 1))
        );
        return fetchWithRetry(endpoint, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    // API-Football returns errors inside the response body even on HTTP 200
    if (data.errors && Object.keys(data.errors).length > 0) {
      const errorMsg = Object.values(data.errors).join(", ");
      throw new Error(`API-Football Error: ${errorMsg}`);
    }

    _requestCount++;
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
 * Map API-Football short status codes to internal status.
 */
export function mapStatus(
  shortCode: string,
): "pending" | "live" | "finished" {
  const statusMap: Record<string, "pending" | "live" | "finished"> = {
    "NS": "pending",
    "TBD": "pending",
    "PST": "pending",
    "INT": "pending",
    "SUSP": "live",
    "1H": "live",
    "HT": "live",
    "2H": "live",
    "ET": "live",
    "BT": "live",
    "P": "live",
    "LIVE": "live",
    "FT": "finished",
    "AET": "finished",
    "PEN": "finished",
    "CANC": "finished",
    "ABD": "finished",
    "AWD": "finished",
    "WO": "finished",
  };
  return statusMap[shortCode] || "pending";
}

/**
 * Detect if a round string indicates a knockout round.
 */
export function isKnockoutRound(round: string | null): boolean {
  if (!round) return false;
  return /Round of 16|Quarter|Semi|Final/i.test(round);
}

/**
 * Normalize an API-Football fixture to the agnostic ApiMatch interface.
 */
export function normalizeMatch(fixture: any): ApiMatch {
  const f = fixture.fixture || {};
  const league = fixture.league || {};
  const teams = fixture.teams || {};
  const goals = fixture.goals || {};
  const homeTeam = teams.home || {};
  const awayTeam = teams.away || {};
  const status = f.status || {};

  const leagueName = Object.keys(API_FOOTBALL_LEAGUE_IDS).find(
    (key) => API_FOOTBALL_LEAGUE_IDS[key] === league.id,
  ) || "Otros";

  return {
    id: String(f.id),
    date: new Date(f.date || f.timestamp * 1000).getTime(),
    league: leagueName,
    leagueId: league.id,
    teams: {
      home: {
        name: homeTeam.name || "N/A",
        badge: homeTeam.logo || "",
        id: homeTeam.id,
      },
      away: {
        name: awayTeam.name || "N/A",
        badge: awayTeam.logo || "",
        id: awayTeam.id,
      },
    },
    status: mapStatus(status.short),
    score: {
      home: goals.home ?? null,
      away: goals.away ?? null,
    },
    minute: status.elapsed || null,
    round: league.round || null,
    isKnockout: isKnockoutRound(league.round),
    season: league.season || null,
  };
}

/**
 * Get supported API-Football league IDs.
 */
function getSupportedLeagueIds(): number[] {
  return Object.values(API_FOOTBALL_LEAGUE_IDS);
}

/**
 * Format a Date as YYYY-MM-DD using UTC methods.
 */
export function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
 */
export function normalizeStandings(data: any): StandingsGroup[] {
  const response = data?.response || [];
  if (response.length === 0) return [];

  const leagueData = response[0];
  if (!leagueData) return [];

  const rawStandings = leagueData.standings ||
    leagueData.league?.standings ||
    [];
  const groups = Array.isArray(rawStandings) ? rawStandings : [];
  const groupCount = Math.min(groups.length, 12);

  return groups.slice(0, groupCount).map(
    (groupStandings: any, index: number) => {
      const group = String.fromCharCode(65 + index); // 65 = 'A'
      const teams = Array.isArray(groupStandings) ? groupStandings : [];

      return {
        group,
        teams: teams.map((entry: any) => ({
          rank: entry?.rank,
          name: entry?.team?.name || entry?.name || "N/A",
          logo: entry?.team?.logo || entry?.logo || "",
          teamId: entry?.team?.id || entry?.id,
          points: entry?.points ?? 0,
          played: entry?.all?.played ?? 0,
          wins: entry?.all?.win ?? 0,
          draws: entry?.all?.draw ?? 0,
          losses: entry?.all?.lose ?? 0,
          goalsFor: entry?.all?.goals?.for ?? 0,
          goalsAgainst: entry?.all?.goals?.against ?? 0,
          goalDiff: (entry?.all?.goals?.for ?? 0) -
            (entry?.all?.goals?.against ?? 0),
        })),
      };
    },
  );
}

// ── API Methods ──────────────────────────────────────────────────────────────

/**
 * Get all matches for a specific LOCAL date.
 * Queries the 2 UTC dates that could contain matches for this local day,
 * then filters results by LOCAL date to handle any timezone offset.
 */
export async function getMatches(date: string): Promise<ApiMatch[]> {
  const targetDate = new Date(date);

  // Calculate the UTC date range that covers this local day
  const localMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const nextMidnight = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate() + 1,
  );

  const utcDates = [...new Set([
    formatUtcDate(localMidnight),
    formatUtcDate(nextMidnight),
  ])];

  // Query both UTC dates in parallel
  const [data1, data2] = await Promise.all([
    fetchWithRetry(`/fixtures?date=${utcDates[0]}`),
    utcDates[1]
      ? fetchWithRetry(`/fixtures?date=${utcDates[1]}`)
      : Promise.resolve({ response: [] }),
  ]);

  const allFixtures = [
    ...(data1.response || []),
    ...(data2.response || []),
  ];
  const supportedIds = getSupportedLeagueIds();

  return allFixtures
    .filter((f: any) => supportedIds.includes(f.league?.id))
    .filter((f: any) => {
      const matchDate = new Date(f.fixture?.date || f.timestamp * 1000);
      return matchDate.getFullYear() === targetDate.getFullYear() &&
        matchDate.getMonth() === targetDate.getMonth() &&
        matchDate.getDate() === targetDate.getDate();
    })
    .map(normalizeMatch);
}

/**
 * Get all currently live matches.
 */
export async function getLiveMatches(): Promise<ApiMatch[]> {
  const data = await fetchWithRetry("/fixtures?live=all");
  const supportedIds = getSupportedLeagueIds();

  return (data.response || [])
    .filter((f: any) => supportedIds.includes(f.league?.id))
    .map(normalizeMatch);
}

/**
 * Get standings for a league and season.
 */
export async function getStandings(
  leagueId: number,
  season: number,
): Promise<StandingsGroup[]> {
  const data = await fetchWithRetry(
    `/standings?league=${leagueId}&season=${season}`,
  );
  return normalizeStandings(data);
}
