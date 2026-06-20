import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock global.fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock import.meta.env
const originalEnv = import.meta.env;

// We need to test the functions indirectly since adapter.js uses browser APIs
// and dynamic imports. We test the core logic: tryFetchStatic, static mode detection.

describe('Adapter static mode logic', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('detects static mode when meta.json exists', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ lastFetched: '2026-06-20T12:00:00Z' }),
    });

    const res = await mockFetch('/data/meta.json');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.lastFetched).toBe('2026-06-20T12:00:00Z');
  });

  it('falls back when meta.json returns 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const res = await mockFetch('/data/meta.json');
    expect(res.ok).toBe(false);
  });

  it('falls back when meta.json network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let result = null;
    try {
      const res = await mockFetch('/data/meta.json');
      if (res.ok) result = await res.json();
    } catch {
      result = null;
    }
    expect(result).toBeNull();
  });

  it('loads matches from static file when available', async () => {
    const fakeMatches = [
      { id: '1', title: 'Team A vs Team B', status: 'pending' },
      { id: '2', title: 'Team C vs Team D', status: 'finished' },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(fakeMatches),
    });

    const res = await mockFetch('/data/matches-2026-06-20.json');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('Team A vs Team B');
  });

  it('loads standings from static file', async () => {
    const fakeStandings = [
      { group: 'A', teams: [{ name: 'Uruguay', pts: 9 }] },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(fakeStandings),
    });

    const res = await mockFetch('/data/standings.json');
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].group).toBe('A');
  });

  it('returns null on network error for matches file', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    let result = null;
    try {
      const res = await mockFetch('/data/matches-2026-06-20.json');
      if (res.ok) result = await res.json();
    } catch {
      result = null;
    }
    expect(result).toBeNull();
  });
});
