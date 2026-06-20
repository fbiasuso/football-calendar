import { describe, it, expect } from 'vitest';
import { mapStatus, normalizeMatch, formatDate, formatUtcDate } from '../api.js';

describe('mapStatus', () => {
  const testCases = [
    ['NS', 'pending'],
    ['TBD', 'pending'],
    ['PST', 'pending'],
    ['INT', 'pending'],
    ['SUSP', 'live'],
    ['1H', 'live'],
    ['HT', 'live'],
    ['2H', 'live'],
    ['ET', 'live'],
    ['BT', 'live'],
    ['P', 'live'],
    ['LIVE', 'live'],
    ['FT', 'finished'],
    ['AET', 'finished'],
    ['PEN', 'finished'],
    ['CANC', 'finished'],
    ['ABD', 'finished'],
    ['AWD', 'finished'],
    ['WO', 'finished'],
  ];

  it.each(testCases)('maps %s → %s', (code, expected) => {
    expect(mapStatus(code)).toBe(expected);
  });

  it('returns pending for unknown codes', () => {
    expect(mapStatus('UNKNOWN')).toBe('pending');
    expect(mapStatus('')).toBe('pending');
    expect(mapStatus(undefined)).toBe('pending');
  });
});

describe('formatDate', () => {
  it('formats a date as YYYY-MM-DD using local timezone', () => {
    // Use a fixed date — midnight Jan 15 2026 in local time
    const date = new Date(2026, 0, 15);
    expect(formatDate(date)).toBe('2026-01-15');
  });

  it('formats December date correctly', () => {
    const date = new Date(2026, 11, 25);
    expect(formatDate(date)).toBe('2026-12-25');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 2, 5);
    expect(formatDate(date)).toBe('2026-03-05');
  });

  it('works with milliseconds timestamp', () => {
    // 2026-06-20 00:00:00 UTC
    const ts = new Date('2026-06-20T00:00:00').getTime();
    expect(formatDate(ts)).toBe('2026-06-20');
  });

  it('works with ISO string', () => {
    expect(formatDate('2026-07-01T14:30:00')).toBe('2026-07-01');
  });
});

describe('formatUtcDate', () => {
  it('formats a date as YYYY-MM-DD using UTC', () => {
    const date = new Date(Date.UTC(2026, 0, 15));
    expect(formatUtcDate(date)).toBe('2026-01-15');
  });

  it('handles timezone offset correctly', () => {
    // Jan 15 2026 23:00 UTC-3 = Jan 16 2026 02:00 UTC
    // So local midnight in UTC-3 on 15th maps to UTC which is still 15th at that time
    const date = new Date('2026-01-15T23:00:00-03:00');
    // In UTC this is 2026-01-16T02:00:00Z
    // formatUtcDate should give 2026-01-16
    expect(formatUtcDate(date)).toBe('2026-01-16');
  });

  it('pads single-digit month and day', () => {
    const date = new Date(Date.UTC(2026, 2, 5));
    expect(formatUtcDate(date)).toBe('2026-03-05');
  });
});

describe('normalizeMatch', () => {
  const mockFixture = {
    fixture: {
      id: 123456,
      date: '2026-06-20T15:00:00+00:00',
      timestamp: 1750422000,
      status: { short: 'FT', elapsed: 90 },
    },
    league: {
      id: 1,
      name: 'World Cup 2026',
      season: 2026,
      round: 'Group Stage - 1',
    },
    teams: {
      home: { id: 100, name: 'Argentina', logo: 'https://example.com/arg.png' },
      away: { id: 200, name: 'Brazil', logo: 'https://example.com/bra.png' },
    },
    goals: { home: 3, away: 1 },
  };

  it('normalizes a finished match correctly', () => {
    const result = normalizeMatch(mockFixture);

    expect(result.id).toBe('123456');
    expect(result.title).toBe('Argentina vs Brazil');
    expect(result.status).toBe('finished');
    expect(result.score.home).toBe(3);
    expect(result.score.away).toBe(1);
    expect(result.league).toBe('World Cup 2026');
    expect(result.leagueId).toBe(1);
    expect(result.season).toBe(2026);
    expect(result.isKnockout).toBe(false);
    expect(result.minute).toBe(90);
    expect(result.teams.home.name).toBe('Argentina');
    expect(result.teams.away.name).toBe('Brazil');
    expect(result.teams.home.badge).toBe('https://example.com/arg.png');
  });

  it('normalizes a live match', () => {
    const liveFixture = {
      ...mockFixture,
      fixture: {
        ...mockFixture.fixture,
        status: { short: '2H', elapsed: 65 },
      },
      goals: { home: 1, away: 0 },
    };
    const result = normalizeMatch(liveFixture);
    expect(result.status).toBe('live');
    expect(result.minute).toBe(65);
    expect(result.score.home).toBe(1);
    expect(result.score.away).toBe(0);
  });

  it('normalizes a pending match', () => {
    const pendingFixture = {
      ...mockFixture,
      fixture: {
        ...mockFixture.fixture,
        status: { short: 'NS', elapsed: null },
      },
      goals: { home: null, away: null },
    };
    const result = normalizeMatch(pendingFixture);
    expect(result.status).toBe('pending');
    expect(result.minute).toBeNull();
    expect(result.score.home).toBeNull();
    expect(result.score.away).toBeNull();
  });

  it('handles missing fixture data gracefully', () => {
    const result = normalizeMatch({});
    expect(result.id).toBe('undefined');
    expect(result.title).toBe('N/A vs N/A');
    expect(result.status).toBe('pending');
    expect(result.score.home).toBeNull();
    expect(result.score.away).toBeNull();
    expect(result.teams.home.name).toBe('N/A');
  });

  it('detects knockout rounds', () => {
    const knockoutFixture = {
      ...mockFixture,
      league: { ...mockFixture.league, round: 'Round of 16' },
    };
    expect(normalizeMatch(knockoutFixture).isKnockout).toBe(true);

    const quarterFixture = {
      ...mockFixture,
      league: { ...mockFixture.league, round: 'Quarter-finals' },
    };
    expect(normalizeMatch(quarterFixture).isKnockout).toBe(true);

    const semiFixture = {
      ...mockFixture,
      league: { ...mockFixture.league, round: 'Semi-finals' },
    };
    expect(normalizeMatch(semiFixture).isKnockout).toBe(true);
  });

  it('assigns "Otros" league for unknown league IDs', () => {
    const unknownFixture = {
      ...mockFixture,
      league: { id: 99999, name: 'Unknown League' },
    };
    expect(normalizeMatch(unknownFixture).league).toBe('Otros');
  });
});
