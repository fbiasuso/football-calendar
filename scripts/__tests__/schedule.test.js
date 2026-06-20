import { describe, it, expect } from 'vitest';
import { getSchedule, isWorldCupPeriod } from '../schedule.js';

/**
 * Create a Date for a given ART (UTC-3) date/time
 * @param {number} year
 * @param {number} month - 0-indexed
 * @param {number} day
 * @param {number} hour - ART hour (0-23)
 * @returns {Date}
 */
function artDate(year, month, day, hour = 0, min = 0) {
  // ART = UTC-3, so we create a Date in UTC then subtract 3h for display
  // new Date(Date.UTC(year, month, day, hour + 3, min)) = that time in ART
  return new Date(Date.UTC(year, month, day, hour + 3, min));
}

// Sample fixture helper
function makeFixture(overrides = {}) {
  return {
    id: '1',
    title: 'Team A vs Team B',
    date: overrides.date || Date.now() + 3600000,
    league: 'Premier League',
    leagueId: 39,
    status: overrides.status || 'pending',
    score: { home: null, away: null },
    minute: null,
    round: null,
    isKnockout: false,
    season: 2026,
    teams: {
      home: { name: 'Team A', badge: '', id: 1 },
      away: { name: 'Team B', badge: '', id: 2 },
    },
    ...overrides,
  };
}

describe('isWorldCupPeriod', () => {
  it('returns true during World Cup (20-jun 2026)', () => {
    const date = new Date('2026-06-20T12:00:00-03:00');
    expect(isWorldCupPeriod(date)).toBe(true);
  });

  it('returns true during World Cup (15-jul 2026)', () => {
    const date = new Date('2026-07-15T12:00:00-03:00');
    expect(isWorldCupPeriod(date)).toBe(true);
  });

  it('returns false before World Cup (19-jun 2026)', () => {
    const date = new Date('2026-06-19T23:59:00-03:00');
    expect(isWorldCupPeriod(date)).toBe(false);
  });

  it('returns false after World Cup (21-jul 2026)', () => {
    const date = new Date('2026-07-21T00:00:00-03:00');
    expect(isWorldCupPeriod(date)).toBe(false);
  });

  it('returns false for regular season date', () => {
    const date = new Date('2026-03-15T12:00:00-03:00');
    expect(isWorldCupPeriod(date)).toBe(false);
  });
});

describe('getSchedule — World Cup mode', () => {
  const wcDate = new Date('2026-07-01T00:00:00-03:00'); // During WC

  it('shouldFetch=true inside active window (14:00 ART)', () => {
    const now = artDate(2026, 6, 1, 14, 0); // July 1, 14:00 ART
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ date: Date.now() + 7200000 })],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('fixtures');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('shouldFetch=false outside active window (10:00 ART)', () => {
    const now = artDate(2026, 6, 1, 10, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(false);
    expect(result.reasons.some(r => r.includes('fuera de ventana'))).toBe(true);
  });

  it('shouldFetch=true with live match → 15min interval', () => {
    const now = artDate(2026, 6, 1, 14, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ status: 'live' })],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('live');
    expect(result.endpoints).toContain('standings');
    // Next planned should be ~15min from now
    const diffMs = result.nextPlanned.getTime() - now.getTime();
    expect(diffMs).toBe(15 * 60 * 1000);
  });

  it('shouldFetch=false with no fixtures', () => {
    const now = artDate(2026, 6, 1, 14, 0);
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(false);
    expect(result.reasons.some(r => r.includes('no hay partidos'))).toBe(true);
  });

  it('shouldFetch=true with next match < 2h → 30min interval', () => {
    const now = artDate(2026, 6, 1, 14, 0);
    const nearFuture = now.getTime() + 30 * 60 * 1000; // 30 min from now
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ date: nearFuture })],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(true);
    const diffMs = result.nextPlanned.getTime() - now.getTime();
    expect(diffMs).toBe(30 * 60 * 1000);
  });

  it('shouldFetch=true with next match > 2h → 2h interval', () => {
    const now = artDate(2026, 6, 1, 14, 0);
    const farFuture = now.getTime() + 3 * 60 * 60 * 1000; // 3h from now
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ date: farFuture })],
      mode: 'worldcup',
    });
    expect(result.shouldFetch).toBe(true);
    const diffMs = result.nextPlanned.getTime() - now.getTime();
    expect(diffMs).toBe(2 * 60 * 60 * 1000);
  });
});

describe('getSchedule — Leagues mode', () => {
  const leagueDate = new Date('2026-03-15T00:00:00-03:00'); // Regular season

  it('shouldFetch=true inside active window (14:00 ART) with fixtures', () => {
    const now = artDate(2026, 2, 15, 14, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('fixtures');
  });

  it('shouldFetch=false outside active window (3:00 ART)', () => {
    const now = artDate(2026, 2, 15, 3, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(false);
    expect(result.reasons.some(r => r.includes('fuera de ventana'))).toBe(true);
  });

  it('shouldFetch=false inside window with active hours but no fixtures and recently fetched', () => {
    const now = artDate(2026, 2, 15, 14, 0);
    const recentFetch = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'leagues',
      lastFetched: recentFetch,
    });
    expect(result.shouldFetch).toBe(false);
  });

  it('shouldFetch=true with no fixtures but 4h elapsed', () => {
    const now = artDate(2026, 2, 15, 14, 0);
    const oldFetch = new Date(now.getTime() - 5 * 60 * 60 * 1000); // 5h ago
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'leagues',
      lastFetched: oldFetch,
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.reasons.some(r => r.includes('4h interval'))).toBe(true);
  });

  it('shouldFetch=true with live match → 15min interval', () => {
    const now = artDate(2026, 2, 15, 14, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ status: 'live' })],
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('live');
    const diffMs = result.nextPlanned.getTime() - now.getTime();
    expect(diffMs).toBe(15 * 60 * 1000);
  });

  it('shouldFetch=true with fixtures (no live) → 30min interval', () => {
    const now = artDate(2026, 2, 15, 14, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ date: now.getTime() + 7200000 })], // 2h from now
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(true);
    const diffMs = result.nextPlanned.getTime() - now.getTime();
    expect(diffMs).toBe(30 * 60 * 1000);
  });

  it('shouldFetch=true in early morning window (08:00 ART) with fixtures', () => {
    const now = artDate(2026, 2, 15, 8, 0);
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(true);
  });

  it('shouldFetch=true in late night window (00:00 ART) with fixtures', () => {
    const now = artDate(2026, 2, 16, 0, 0); // Midnight, still in window
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      mode: 'leagues',
    });
    expect(result.shouldFetch).toBe(true);
  });
});

describe('getSchedule — Off-hours schedule refresh', () => {
  it('shouldFetch=true at 5:00 ART with no fetch today (leagues mode)', () => {
    const now = artDate(2026, 2, 15, 5, 0);
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'leagues',
      lastFetched: null,
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('fixtures');
  });

  it('shouldFetch=true at 5:00 ART with no fetch today (worldcup mode)', () => {
    const now = artDate(2026, 6, 1, 5, 0);
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'worldcup',
      lastFetched: null,
    });
    expect(result.shouldFetch).toBe(true);
    expect(result.endpoints).toContain('fixtures');
  });

  it('shouldFetch=false at 5:00 ART if already fetched today', () => {
    const now = artDate(2026, 2, 15, 5, 0);
    const todayFetch = new Date(now.getTime()); // Already fetched today
    const result = getSchedule({
      now,
      knownFixtures: [],
      mode: 'leagues',
      lastFetched: todayFetch,
    });
    expect(result.shouldFetch).toBe(false);
    expect(result.reasons.some(r => r.includes('already fetched'))).toBe(true);
  });
});

describe('getSchedule — Auto mode detection', () => {
  it('detects worldcup mode during WC period', () => {
    const now = artDate(2026, 6, 1, 14, 0); // July 1, 14:00 ART
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture({ date: now.getTime() + 3600000 })],
      // no mode — auto-detect
    });
    expect(result.shouldFetch).toBe(true);
  });

  it('detects leagues mode outside WC period', () => {
    const now = artDate(2026, 2, 15, 14, 0); // March 15
    const result = getSchedule({
      now,
      knownFixtures: [makeFixture()],
      // no mode — auto-detect
    });
    expect(result.shouldFetch).toBe(true);
  });
});
