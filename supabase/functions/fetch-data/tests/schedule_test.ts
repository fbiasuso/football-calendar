// deno-lint-ignore-file no-explicit-any
// Tests for schedule.ts — port of scripts/__tests__/schedule.test.js
//
// Run: deno test supabase/functions/fetch-data/tests/schedule_test.ts

import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import { getSchedule, isWorldCupPeriod } from "../schedule.ts";

/**
 * Create a Date for a given ART (UTC-3) date/time.
 */
function artDate(year: number, month: number, day: number, hour = 0, min = 0): Date {
  return new Date(Date.UTC(year, month, day, hour + 3, min));
}

/**
 * Create a minimal fixture-like object for schedule testing.
 */
function makeFixture(overrides: Partial<{
  date: number;
  status: "pending" | "live" | "finished";
}> = {}): any {
  return {
    id: "1",
    date: overrides.date ?? Date.now() + 3600000,
    status: overrides.status ?? "pending",
  };
}

// ── isWorldCupPeriod ─────────────────────────────────────────────────────────

Deno.test("isWorldCupPeriod — returns true during World Cup (20-jun 2026)", () => {
  const date = new Date("2026-06-20T12:00:00-03:00");
  assertEquals(isWorldCupPeriod(date), true);
});

Deno.test("isWorldCupPeriod — returns true during World Cup (15-jul 2026)", () => {
  const date = new Date("2026-07-15T12:00:00-03:00");
  assertEquals(isWorldCupPeriod(date), true);
});

Deno.test("isWorldCupPeriod — returns false before World Cup (19-jun 2026)", () => {
  const date = new Date("2026-06-19T23:59:00-03:00");
  assertEquals(isWorldCupPeriod(date), false);
});

Deno.test("isWorldCupPeriod — returns false after World Cup (21-jul 2026)", () => {
  const date = new Date("2026-07-21T00:00:00-03:00");
  assertEquals(isWorldCupPeriod(date), false);
});

Deno.test("isWorldCupPeriod — returns false for regular season date", () => {
  const date = new Date("2026-03-15T12:00:00-03:00");
  assertEquals(isWorldCupPeriod(date), false);
});

// ── getSchedule — World Cup mode ─────────────────────────────────────────────

Deno.test("getSchedule — WC: shouldFetch=true inside active window (14:00 ART)", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ date: Date.now() + 7200000 })],
    mode: "worldcup",
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("fixtures"));
  assert(result.reasons.length > 0);
});

Deno.test("getSchedule — WC: shouldFetch=false outside active window (10:00 ART)", () => {
  const now = artDate(2026, 6, 1, 10, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    mode: "worldcup",
  });
  assertEquals(result.shouldFetch, false);
  assert(result.reasons.some((r) => r.includes("fuera de ventana")));
});

Deno.test("getSchedule — WC: shouldFetch=true with live match → 15min interval", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ status: "live" })],
    mode: "worldcup",
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("live"));
  assert(result.endpoints.includes("standings"));
  const diffMs = result.nextPlanned.getTime() - now.getTime();
  assertEquals(diffMs, 15 * 60 * 1000);
});

Deno.test("getSchedule — WC: shouldFetch=false with no fixtures and recently fetched (1h < 2h)", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const lastFetched = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "worldcup",
    lastFetched,
  });
  assertEquals(result.shouldFetch, false);
  assert(result.reasons.some((r) => r.includes("2h interval")));
});

Deno.test("getSchedule — WC: shouldFetch=true with next match < 2h → 30min interval", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const nearFuture = now.getTime() + 30 * 60 * 1000; // 30 min from now
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ date: nearFuture })],
    mode: "worldcup",
  });
  assertEquals(result.shouldFetch, true);
  const diffMs = result.nextPlanned.getTime() - now.getTime();
  assertEquals(diffMs, 30 * 60 * 1000);
});

Deno.test("getSchedule — WC: shouldFetch=true with next match > 2h → 2h interval", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const farFuture = now.getTime() + 3 * 60 * 60 * 1000; // 3h from now
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ date: farFuture })],
    mode: "worldcup",
  });
  assertEquals(result.shouldFetch, true);
  const diffMs = result.nextPlanned.getTime() - now.getTime();
  assertEquals(diffMs, 2 * 60 * 60 * 1000);
});

// ── getSchedule — Leagues mode ───────────────────────────────────────────────

Deno.test("getSchedule — LG: shouldFetch=true inside active window (14:00 ART) with fixtures", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("fixtures"));
});

Deno.test("getSchedule — LG: shouldFetch=false outside active window (3:00 ART)", () => {
  const now = artDate(2026, 2, 15, 3, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, false);
  assert(result.reasons.some((r) => r.includes("fuera de ventana")));
});

Deno.test("getSchedule — LG: shouldFetch=false inside window with no fixtures and recently fetched", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const recentFetch = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "leagues",
    lastFetched: recentFetch,
  });
  assertEquals(result.shouldFetch, false);
});

Deno.test("getSchedule — LG: shouldFetch=true with no fixtures but 4h elapsed", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const oldFetch = new Date(now.getTime() - 5 * 60 * 60 * 1000); // 5h ago
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "leagues",
    lastFetched: oldFetch,
  });
  assertEquals(result.shouldFetch, true);
  assert(result.reasons.some((r) => r.includes("4h interval")));
});

Deno.test("getSchedule — LG: shouldFetch=true with live match → 15min interval", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ status: "live" })],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("live"));
  const diffMs = result.nextPlanned.getTime() - now.getTime();
  assertEquals(diffMs, 15 * 60 * 1000);
});

Deno.test("getSchedule — LG: shouldFetch=true with fixtures (no live) → 30min interval", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ date: now.getTime() + 7200000 })],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, true);
  const diffMs = result.nextPlanned.getTime() - now.getTime();
  assertEquals(diffMs, 30 * 60 * 1000);
});

Deno.test("getSchedule — LG: shouldFetch=true at 08:00 ART (window start) with fixtures", () => {
  const now = artDate(2026, 2, 15, 8, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, true);
});

Deno.test("getSchedule — LG: shouldFetch=true at 00:00 ART (late night window) with fixtures", () => {
  const now = artDate(2026, 2, 16, 0, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    mode: "leagues",
  });
  assertEquals(result.shouldFetch, true);
});

// ── getSchedule — Off-hours schedule refresh ─────────────────────────────────

Deno.test("getSchedule — Off-hours: shouldFetch=true at 5:00 ART no fetch today (leagues)", () => {
  const now = artDate(2026, 2, 15, 5, 0);
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "leagues",
    lastFetched: null,
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("fixtures"));
});

Deno.test("getSchedule — Off-hours: shouldFetch=true at 5:00 ART no fetch today (worldcup)", () => {
  const now = artDate(2026, 6, 1, 5, 0);
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "worldcup",
    lastFetched: null,
  });
  assertEquals(result.shouldFetch, true);
  assert(result.endpoints.includes("fixtures"));
});

Deno.test("getSchedule — Off-hours: shouldFetch=false at 5:00 ART if already fetched today", () => {
  const now = artDate(2026, 2, 15, 5, 0);
  const todayFetch = new Date(now.getTime());
  const result = getSchedule({
    now,
    knownFixtures: [],
    mode: "leagues",
    lastFetched: todayFetch,
  });
  assertEquals(result.shouldFetch, false);
  assert(result.reasons.some((r) => r.includes("already fetched")));
});

// ── getSchedule — Auto mode detection ────────────────────────────────────────

Deno.test("getSchedule — Auto: detects worldcup during WC period", () => {
  const now = artDate(2026, 6, 1, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture({ date: now.getTime() + 3600000 })],
    // no mode — auto-detect
  });
  assertEquals(result.shouldFetch, true);
});

Deno.test("getSchedule — Auto: detects leagues outside WC period", () => {
  const now = artDate(2026, 2, 15, 14, 0);
  const result = getSchedule({
    now,
    knownFixtures: [makeFixture()],
    // no mode — auto-detect
  });
  assertEquals(result.shouldFetch, true);
});
