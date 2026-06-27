// deno-lint-ignore-file no-explicit-any
// Tests for api.ts (mocked fetch) + db.ts (mocked supabase client)
//
// Run: deno test --allow-env supabase/functions/fetch-data/tests/api_test.ts

import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import {
  mapStatus,
  isKnockoutRound,
  normalizeMatch,
  normalizeStandings,
  formatUtcDate,
  formatLocalDate,
} from "../api.ts";
import { updatePipelineMeta } from "../db.ts";

// ── Helper: mock fetch ───────────────────────────────────────────────────────

type FetchHandler = (url: string, options?: any) => Promise<Response>;

let originalFetch: typeof fetch;

function mockFetch(handler: FetchHandler): void {
  originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
}

function restoreFetch(): void {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Helper: mock Supabase client ─────────────────────────────────────────────

function createMockSupabaseClient(overrides: Record<string, any> = {}) {
  const defaultFrom = (table: string) => ({
    select: (cols: string) => {
      if (table === "leagues") {
        return Promise.resolve({
          data: [{ id: 1, api_id: 1 }, { id: 2, api_id: 39 }],
          error: null,
        });
      }
      if (table === "teams") {
        return Promise.resolve({
          data: [
            { id: 10, api_id: 100 },
            { id: 20, api_id: 200 },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    },
    upsert: (_rows: any, _options?: any) => {
      return Promise.resolve({ data: null, error: null });
    },
    ...overrides[table],
  });

  return {
    from: (table: string) => defaultFrom(table),
  };
}

// ── mapStatus ────────────────────────────────────────────────────────────────

Deno.test("mapStatus — maps SCHEDULED to pending", () => {
  assertEquals(mapStatus("SCHEDULED"), "pending");
});

Deno.test("mapStatus — maps TIMED to pending", () => {
  assertEquals(mapStatus("TIMED"), "pending");
});

Deno.test("mapStatus — maps IN_PLAY to live", () => {
  assertEquals(mapStatus("IN_PLAY"), "live");
});

Deno.test("mapStatus — maps PAUSED to live", () => {
  assertEquals(mapStatus("PAUSED"), "live");
});

Deno.test("mapStatus — maps LIVE to live", () => {
  assertEquals(mapStatus("LIVE"), "live");
});

Deno.test("mapStatus — maps FINISHED to finished", () => {
  assertEquals(mapStatus("FINISHED"), "finished");
});

Deno.test("mapStatus — maps CANCELLED to finished", () => {
  assertEquals(mapStatus("CANCELLED"), "finished");
});

Deno.test("mapStatus — maps unknown to pending", () => {
  assertEquals(mapStatus("UNKNOWN"), "pending");
});

// ── isKnockoutRound ──────────────────────────────────────────────────────────

Deno.test("isKnockoutRound — detects ROUND_OF_16", () => {
  assertEquals(isKnockoutRound("ROUND_OF_16"), true);
});

Deno.test("isKnockoutRound — detects QUARTER_FINALS", () => {
  assertEquals(isKnockoutRound("QUARTER_FINALS"), true);
});

Deno.test("isKnockoutRound — detects SEMI_FINALS", () => {
  assertEquals(isKnockoutRound("SEMI_FINALS"), true);
});

Deno.test("isKnockoutRound — detects FINAL", () => {
  assertEquals(isKnockoutRound("FINAL"), true);
});

Deno.test("isKnockoutRound — returns false for REGULAR_SEASON", () => {
  assertEquals(isKnockoutRound("REGULAR_SEASON"), false);
});

Deno.test("isKnockoutRound — returns false for null", () => {
  assertEquals(isKnockoutRound(null), false);
});

// ── normalizeMatch ───────────────────────────────────────────────────────────

const sampleFixture = {
  id: 123456,
  utcDate: "2026-06-23T20:00:00Z",
  status: "SCHEDULED",
  matchday: 1,
  stage: "REGULAR_SEASON",
  season: { id: 2026 },
  competition: { id: 2021, name: "Premier League" },
  homeTeam: { id: 33, name: "Manchester United", crest: "https://example.com/manu.png" },
  awayTeam: { id: 34, name: "Newcastle", crest: "https://example.com/newc.png" },
  score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
};

Deno.test("normalizeMatch — returns correct shape", () => {
  const result = normalizeMatch(sampleFixture);
  assertEquals(result.id, "123456");
  assertEquals(result.league, "Premier League");
  assertEquals(result.leagueId, 3);
  assertEquals(result.status, "pending");
  assertEquals(result.teams.home.name, "Manchester United");
  assertEquals(result.teams.away.name, "Newcastle");
  assertEquals(result.score.home, null);
  assertEquals(result.score.away, null);
  assertEquals(result.isKnockout, false);
  assertEquals(result.season, 2026);
});

Deno.test("normalizeMatch — maps league name correctly", () => {
  const wcFixture = {
    ...sampleFixture,
    competition: { ...sampleFixture.competition, id: 2000 },
  };
  const result = normalizeMatch(wcFixture);
  assertEquals(result.league, "World Cup 2026");
});

Deno.test("normalizeMatch — handles live match with scores", () => {
  const liveFixture = {
    id: 654321,
    utcDate: "2026-06-23T21:00:00Z",
    status: "LIVE",
    matchMinutes: 65,
    stage: null,
    season: { id: 2026 },
    competition: { id: 2021 },
    homeTeam: { id: 33, name: "Chelsea", crest: "" },
    awayTeam: { id: 34, name: "Arsenal", crest: "" },
    score: { fullTime: { home: 2, away: 1 }, halfTime: { home: null, away: null } },
  };
  const result = normalizeMatch(liveFixture);
  assertEquals(result.status, "live");
  assertEquals(result.minute, 65);
  assertEquals(result.score.home, 2);
  assertEquals(result.score.away, 1);
});

// ── normalizeStandings ───────────────────────────────────────────────────────

const sampleStandingsResponse = {
  standings: [
    {
      type: "TOTAL",
      group: "GROUP_A",
      table: [
        { position: 1, team: { id: 1, name: "Team A", crest: "" }, playedGames: 2, won: 2, draw: 0, lost: 0, points: 6, goalsFor: 5, goalsAgainst: 1, goalDifference: 4 },
        { position: 2, team: { id: 2, name: "Team B", crest: "" }, playedGames: 2, won: 1, draw: 0, lost: 1, points: 3, goalsFor: 3, goalsAgainst: 3, goalDifference: 0 },
      ],
    },
    {
      type: "TOTAL",
      group: "GROUP_B",
      table: [
        { position: 1, team: { id: 3, name: "Team C", crest: "" }, playedGames: 2, won: 1, draw: 1, lost: 0, points: 4, goalsFor: 2, goalsAgainst: 1, goalDifference: 1 },
      ],
    },
  ],
};

Deno.test("normalizeStandings — returns groups with correct shape", () => {
  const result = normalizeStandings(sampleStandingsResponse);
  assertEquals(result.length, 2);
  assertEquals(result[0].group, "A");
  assertEquals(result[1].group, "B");
});

Deno.test("normalizeStandings — computes goalDiff correctly", () => {
  const result = normalizeStandings(sampleStandingsResponse);
  assertEquals(result[0].teams[0].goalDiff, 4); // 5 - 1
  assertEquals(result[0].teams[1].goalDiff, 0); // 3 - 3
});

Deno.test("normalizeStandings — returns empty array for empty standings", () => {
  assertEquals(normalizeStandings({ standings: [] }), []);
});

Deno.test("normalizeStandings — returns empty array for null data", () => {
  assertEquals(normalizeStandings({}), []);
});

// ── formatUtcDate ────────────────────────────────────────────────────────────

Deno.test("formatUtcDate — formats correctly", () => {
  const date = new Date(Date.UTC(2026, 5, 23)); // June 23, 2026 UTC
  assertEquals(formatUtcDate(date), "2026-06-23");
});

Deno.test("formatUtcDate — pads month and day", () => {
  const date = new Date(Date.UTC(2026, 0, 5)); // Jan 5, 2026 UTC
  assertEquals(formatUtcDate(date), "2026-01-05");
});

// ── formatLocalDate ──────────────────────────────────────────────────────────

Deno.test("formatLocalDate — returns a valid date string", () => {
  const date = new Date("2026-06-23T12:00:00");
  const result = formatLocalDate(date);
  // Just verify it's a 10-char YYYY-MM-DD string
  assertEquals(result.length, 10);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(result));
});

// ── db.ts — updatePipelineMeta with mock client ──────────────────────────────

Deno.test("updatePipelineMeta — calls upsert with correct payload", async () => {
  let upsertedPayload: any = null;
  let upsertOptions: any = null;

  const mockClient = {
    from: (_table: string) => ({
      upsert: (payload: any, options?: any) => {
        upsertedPayload = payload;
        upsertOptions = options;
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };

  await updatePipelineMeta(mockClient as any, {
    last_fetched: "2026-06-23T12:00:00Z",
    next_planned: "2026-06-23T13:00:00Z",
    mode: "worldcup",
    error_count: 0,
    last_error: null,
  });

  assertEquals(upsertedPayload.id, 1);
  assertEquals(upsertedPayload.last_fetched, "2026-06-23T12:00:00Z");
  assertEquals(upsertedPayload.mode, "worldcup");
  assertEquals(upsertOptions?.onConflict, "id");
});

Deno.test("updatePipelineMeta — throws on error", async () => {
  const mockClient = {
    from: (_table: string) => ({
      upsert: () => {
        return Promise.resolve({ data: null, error: new Error("DB error") });
      },
    }),
  };

  try {
    await updatePipelineMeta(mockClient as any, { mode: "off" });
    assert(false, "Expected error was not thrown");
  } catch (e: any) {
    assert(e.message.includes("DB error"));
  }
});

// ── api.ts — getMatches with mocked fetch ────────────────────────────────────

Deno.test("getMatches — calls API and returns normalized matches", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  const originalEnv = Deno.env.get(envKey);
  // We can't easily set env in tests without --allow-env, so we skip if not set
  if (!originalEnv) {
    console.warn("Skipping: VITE_FOOTBALL_API_KEY not set in environment");
    return;
  }

  const apiResponse = {
    matches: [{
      id: 1,
      utcDate: "2026-06-23T20:00:00Z",
      status: "SCHEDULED",
      stage: null,
      season: { id: 2026 },
      competition: { id: 2021, name: "Premier League" },
      homeTeam: { id: 33, name: "Team H", crest: "" },
      awayTeam: { id: 34, name: "Team A", crest: "" },
      score: { fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    }],
  };

  mockFetch((url: string) => {
    assert(url.includes("/matches?dateFrom="));
    assert(url.includes("football-data.org"));
    return Promise.resolve(jsonResponse(apiResponse));
  });

  try {
    // Dynamic import to avoid module-level env check
    const { getMatches } = await import("../api.ts");
    const result = await getMatches("2026-06-23");
    assert(Array.isArray(result));
    // Filtering: League 2021 (Premier League) is supported
    assertEquals(result.length, 1);
    assertEquals(result[0].id, "1");
    assertEquals(result[0].leagueId, 3);
  } finally {
    restoreFetch();
  }
});

Deno.test("getMatches — returns empty array for no matching fixtures", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  if (!Deno.env.get(envKey)) return;

  mockFetch(() => {
    return Promise.resolve(jsonResponse({ matches: [] }));
  });

  try {
    const { getMatches } = await import("../api.ts");
    const result = await getMatches("2026-06-23");
    assertEquals(result, []);
  } finally {
    restoreFetch();
  }
});

// ── api.ts — getLiveMatches with mocked fetch ────────────────────────────────

Deno.test("getLiveMatches — returns normalized live matches", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  if (!Deno.env.get(envKey)) return;

  const apiResponse = {
    matches: [{
      id: 999,
      utcDate: "2026-06-23T21:00:00Z",
      status: "LIVE",
      matchMinutes: 70,
      stage: null,
      season: { id: 2026 },
      competition: { id: 2021 },
      homeTeam: { id: 33, name: "Live H", crest: "" },
      awayTeam: { id: 34, name: "Live A", crest: "" },
      score: { fullTime: { home: 2, away: 2 }, halfTime: { home: null, away: null } },
    }],
  };

  mockFetch((url: string) => {
    assert(url.includes("/matches?status=LIVE"));
    return Promise.resolve(jsonResponse(apiResponse));
  });

  try {
    const { getLiveMatches } = await import("../api.ts");
    const result = await getLiveMatches();
    assertEquals(result.length, 1);
    assertEquals(result[0].id, "999");
    assertEquals(result[0].status, "live");
    assertEquals(result[0].minute, 70);
  } finally {
    restoreFetch();
  }
});

// ── api.ts — getStandings with mocked fetch ──────────────────────────────────

Deno.test("getStandings — returns normalized standings groups", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  if (!Deno.env.get(envKey)) return;

  mockFetch((url: string) => {
    assert(url.includes("/competitions/2000/standings"));
    return Promise.resolve(jsonResponse(sampleStandingsResponse));
  });

  try {
    const { getStandings } = await import("../api.ts");
    const result = await getStandings(1, 2026);
    assertEquals(result.length, 2);
    assertEquals(result[0].group, "A");
    assertEquals(result[0].teams[0].name, "Team A");
    assertEquals(result[0].teams[0].goalDiff, 4);
  } finally {
    restoreFetch();
  }
});

// ── api.ts — fetchWithRetry retry on 429 ─────────────────────────────────────

Deno.test("fetchWithRetry — retries on 429 and succeeds", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  if (!Deno.env.get(envKey)) return;

  let callCount = 0;

  mockFetch(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(new Response("Too Many Requests", { status: 429 }));
    }
    return Promise.resolve(jsonResponse({ response: [{ id: 1 }] }));
  });

  try {
    const { fetchWithRetry } = await import("../api.ts");
    const result = await fetchWithRetry("/test", 0);
    assertEquals(callCount, 2);
    assertEquals(result.response[0].id, 1);
  } finally {
    restoreFetch();
  }
});

Deno.test("fetchWithRetry — throws after exhausting retries on 429", async () => {
  const envKey = "VITE_FOOTBALL_API_KEY";
  if (!Deno.env.get(envKey)) return;

  let callCount = 0;

  mockFetch(() => {
    callCount++;
    return Promise.resolve(new Response("Too Many Requests", { status: 429 }));
  });

  try {
    const { fetchWithRetry } = await import("../api.ts");
    await fetchWithRetry("/test", 0);
    assert(false, "Expected error was not thrown");
  } catch (e: any) {
    assert(e.message.includes("API Error: 429"));
    assert(callCount >= 4); // initial + 3 retries
  } finally {
    restoreFetch();
  }
});

// ── db.ts — upsertMatches with mock client ───────────────────────────────────

Deno.test("upsertMatches — upserts match data with FK mapping", async () => {
  let upsertedRows: any[] = [];

  const mockClient = {
    from: (table: string) => {
      if (table === "leagues") {
        return {
          select: () =>
            Promise.resolve({
              data: [{ id: 3, api_id: 2021 }],
              error: null,
            }),
        };
      }
      if (table === "teams") {
        return {
          select: () =>
            Promise.resolve({
              data: [
                { id: 10, api_id: 33 },
                { id: 20, api_id: 34 },
              ],
              error: null,
            }),
        };
      }
      if (table === "matches") {
        return {
          upsert: (rows: any[], options?: any) => {
            upsertedRows = rows;
            return Promise.resolve({ data: null, error: null });
          },
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    },
  };

  const { upsertMatches } = await import("../db.ts");

  const testMatches = [{
    id: "123",
    leagueId: 3,
    date: new Date("2026-06-23T20:00:00Z").getTime(),
    teams: {
      home: { id: 33, name: "Home", badge: "", },
      away: { id: 34, name: "Away", badge: "", },
    },
    status: "pending" as const,
    score: { home: null, away: null },
    minute: null,
    round: null,
    isKnockout: false,
    season: 2026,
  }];

  const count = await upsertMatches(mockClient as any, testMatches);
  assertEquals(count, 1);
  assertEquals(upsertedRows.length, 1);
  assertEquals(upsertedRows[0].id, "123");
  assertEquals(upsertedRows[0].league_id, 3);
  assertEquals(upsertedRows[0].home_team_id, 10);
  assertEquals(upsertedRows[0].away_team_id, 20);
  assertEquals(upsertedRows[0].status, "scheduled"); // pending → scheduled
});

Deno.test("upsertMatches — returns 0 for empty input", async () => {
  const { upsertMatches } = await import("../db.ts");
  const count = await upsertMatches({} as any, []);
  assertEquals(count, 0);
});
