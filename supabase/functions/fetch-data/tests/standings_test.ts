// standings_test.ts — Tests for local standings computation (pure functions)
// Run: deno test --allow-read supabase/functions/fetch-data/tests/standings_test.ts

import { assertEquals, assert } from "jsr:@std/assert";

import {
  getMatchGroup,
  aggregateStats,
  statsToStandings,
  buildH2HCache,
  getH2H,
  compareTeams,
  type TeamStats,
  type RawMatch,
} from "../standings-core.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMatch(overrides: Partial<RawMatch> = {}): RawMatch {
  return {
    id: "1",
    home_team_id: 100,
    away_team_id: 200,
    home_score: 0,
    away_score: 0,
    status: "finished",
    date: "2026-06-20T00:00:00Z",
    round: "Group Stage",
    ...overrides,
  };
}

// ── getMatchGroup ────────────────────────────────────────────────────────────

Deno.test("getMatchGroup — returns group when both teams are in same group", () => {
  const map = { 100: "A", 200: "A" };
  assertEquals(getMatchGroup(makeMatch({ home_team_id: 100, away_team_id: 200 }), map), "A");
});

Deno.test("getMatchGroup — returns null when teams are in different groups", () => {
  const map = { 100: "A", 200: "B" };
  assertEquals(getMatchGroup(makeMatch({ home_team_id: 100, away_team_id: 200 }), map), null);
});

Deno.test("getMatchGroup — returns null when team not found in map", () => {
  const map = { 100: "A" };
  assertEquals(getMatchGroup(makeMatch({ home_team_id: 100, away_team_id: 999 }), map), null);
});

// ── aggregateStats ───────────────────────────────────────────────────────────

Deno.test("aggregateStats — computes basic group correctly", () => {
  const map = { 100: "A", 200: "A", 300: "A", 400: "A" };
  const matches = [
    makeMatch({ id: "1", home_team_id: 100, away_team_id: 200, home_score: 2, away_score: 1 }),
    makeMatch({ id: "2", home_team_id: 300, away_team_id: 400, home_score: 0, away_score: 0 }),
    makeMatch({ id: "3", home_team_id: 100, away_team_id: 300, home_score: 3, away_score: 0 }),
  ];

  const stats = aggregateStats(matches, map);
  assertEquals(stats.size, 4);

  const t100 = stats.get(100)!;
  assertEquals(t100.played, 2);
  assertEquals(t100.wins, 2);
  assertEquals(t100.goalsFor, 5);
  assertEquals(t100.goalsAgainst, 1);

  const t300 = stats.get(300)!;
  assertEquals(t300.played, 2);
  assertEquals(t300.wins, 0);
  assertEquals(t300.draws, 1);
  assertEquals(t300.goalsFor, 0);
  assertEquals(t300.goalsAgainst, 3);
});

Deno.test("aggregateStats — skips cross-group (knockout) matches", () => {
  const map = { 100: "A", 200: "B" };
  const stats = aggregateStats(
    [makeMatch({ home_team_id: 100, away_team_id: 200, home_score: 1, away_score: 0 })],
    map,
  );
  assertEquals(stats.size, 0);
});

Deno.test("aggregateStats — skips matches with null scores (pending)", () => {
  const map = { 100: "A", 200: "A" };
  const stats = aggregateStats(
    [makeMatch({ home_team_id: 100, away_team_id: 200, home_score: null, away_score: null })],
    map,
  );
  assertEquals(stats.get(100)!.played, 0);
});

Deno.test("aggregateStats — handles away wins", () => {
  const map = { 100: "A", 200: "A" };
  const stats = aggregateStats(
    [makeMatch({ home_team_id: 100, away_team_id: 200, home_score: 1, away_score: 3 })],
    map,
  );
  assertEquals(stats.get(100)!.wins, 0);
  assertEquals(stats.get(100)!.losses, 1);
  assertEquals(stats.get(200)!.wins, 1);
  assertEquals(stats.get(200)!.losses, 0);
  assertEquals(stats.get(200)!.goalsFor, 3);
  assertEquals(stats.get(200)!.goalsAgainst, 1);
});

// ── compareTeams (tiebreakers) ──────────────────────────────────────────────

Deno.test("compareTeams — sorts by points descending", () => {
  const a: TeamStats = { teamId: 1, group: "A", played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 4, goalsAgainst: 1 };
  const b: TeamStats = { teamId: 2, group: "A", played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2 };
  assert(compareTeams(a, b, new Map()) < 0);
});

Deno.test("compareTeams — sorts by GD when points equal", () => {
  const a: TeamStats = { teamId: 1, group: "A", played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 5, goalsAgainst: 2 };
  const b: TeamStats = { teamId: 2, group: "A", played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 2 };
  assert(compareTeams(a, b, new Map()) < 0);
});

Deno.test("compareTeams — sorts by GF when GD and points equal", () => {
  const a: TeamStats = { teamId: 1, group: "A", played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 4, goalsAgainst: 2 };
  const b: TeamStats = { teamId: 2, group: "A", played: 2, wins: 1, draws: 1, losses: 0, goalsFor: 3, goalsAgainst: 1 };
  assert(compareTeams(a, b, new Map()) < 0);
});

Deno.test("compareTeams — uses H2H when points, GD, and GF are equal", () => {
  const a: TeamStats = { teamId: 1, group: "A", played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2 };
  const b: TeamStats = { teamId: 2, group: "A", played: 2, wins: 1, draws: 0, losses: 1, goalsFor: 2, goalsAgainst: 2 };
  const matches = [makeMatch({ home_team_id: 1, away_team_id: 2, home_score: 2, away_score: 0 })];
  const h2h = buildH2HCache(matches);
  assert(compareTeams(a, b, h2h) < 0, "a (beat b 2-0) should rank higher");
});

// ── buildH2HCache + getH2H ──────────────────────────────────────────────────

Deno.test("buildH2HCache — stores correct H2H points", () => {
  const h2h = buildH2HCache([makeMatch({ home_team_id: 100, away_team_id: 200, home_score: 2, away_score: 1 })]);
  const h = getH2H(h2h, 100, 200);
  assertEquals(h.ptsA, 3);
  assertEquals(h.ptsB, 0);
});

Deno.test("buildH2HCache — handles reverse team order in getH2H", () => {
  const h2h = buildH2HCache([makeMatch({ home_team_id: 100, away_team_id: 200, home_score: 2, away_score: 1 })]);
  const h = getH2H(h2h, 200, 100);
  assertEquals(h.ptsA, 0); // 200 is "a" (first arg), they lost
  assertEquals(h.ptsB, 3); // 100 is "b", they won
});

Deno.test("buildH2HCache — tracks GD and GF correctly", () => {
  const h2h = buildH2HCache([makeMatch({ home_team_id: 100, away_team_id: 200, home_score: 3, away_score: 1 })]);
  const h = getH2H(h2h, 100, 200);
  assertEquals(h.gdA, 2);
  assertEquals(h.gfA, 3);
  assertEquals(h.gdB, -2);
  assertEquals(h.gfB, 1);
});

// ── statsToStandings (integration) ──────────────────────────────────────────

Deno.test("statsToStandings — produces correct rankings for a complete group", () => {
  const map = { 100: "A", 200: "A", 300: "A", 400: "A" };
  const matches = [
    makeMatch({ id: "1", home_team_id: 100, away_team_id: 200, home_score: 2, away_score: 1 }),
    makeMatch({ id: "2", home_team_id: 300, away_team_id: 400, home_score: 0, away_score: 1 }),
    makeMatch({ id: "3", home_team_id: 100, away_team_id: 300, home_score: 3, away_score: 0 }),
    makeMatch({ id: "4", home_team_id: 200, away_team_id: 400, home_score: 1, away_score: 1 }),
  ];

  const standings = statsToStandings(aggregateStats(matches, map), map, matches);
  assertEquals(standings.length, 1);
  assertEquals(standings[0].group, "A");

  const teams = standings[0].teams;
  assertEquals(teams[0].teamId, 100); // 6pts → 1st
  assertEquals(teams[0].points, 6);
  assertEquals(teams[1].teamId, 400); // 4pts → 2nd
  assertEquals(teams[1].points, 4);
  assertEquals(teams[2].teamId, 200); // 1pt → 3rd
  assertEquals(teams[2].points, 1);
  assertEquals(teams[3].teamId, 300); // 0pts → 4th
  assertEquals(teams[3].points, 0);
});

Deno.test("statsToStandings — sorts by GD within same points", () => {
  const map = { 100: "A", 200: "A", 300: "A", 400: "A" };
  const matches = [
    makeMatch({ id: "1", home_team_id: 100, away_team_id: 200, home_score: 0, away_score: 1 }),
    makeMatch({ id: "2", home_team_id: 300, away_team_id: 400, home_score: 3, away_score: 0 }),
    makeMatch({ id: "3", home_team_id: 200, away_team_id: 300, home_score: 1, away_score: 0 }),
    makeMatch({ id: "4", home_team_id: 100, away_team_id: 400, home_score: 2, away_score: 1 }),
  ];

  const teams = statsToStandings(aggregateStats(matches, map), map, matches)[0].teams;
  assertEquals(teams[0].teamId, 200); // 6pts, GD+2 → 1st
  assertEquals(teams[1].teamId, 300); // 3pts, GD+2 → 2nd
  assertEquals(teams[2].teamId, 100); // 3pts, GD+0 → 3rd
  assertEquals(teams[3].teamId, 400); // 0pts → 4th
});

Deno.test("statsToStandings — returns empty array for no matches", () => {
  const map = { 100: "A", 200: "A" };
  assertEquals(statsToStandings(aggregateStats([], map), map, []), []);
});
