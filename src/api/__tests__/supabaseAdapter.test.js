// supabaseAdapter unit tests
// Mocks the supabase client and verifies normalized output shape per R2–R5
//
// Spec: openspec/specs/supabase-consumption/spec.md

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase Client ───────────────────────────────────────────────────
// The chain is a plain object that all fluent methods return.
// `await chain` is a no-op (returns chain), and the destructuring
// `const { data, error } = chain` reads properties we set per-test.
// This avoids issues with multiple .order() calls (standings, bracket_nodes).

const { mockFrom, chain } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    // Default destructure targets (overridden in each test)
    data: null,
    error: null,
  };

  // Each method returns the chain for fluent chaining
  chain.select.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lt.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);

  return {
    mockFrom: vi.fn(() => chain),
    chain,
  };
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a fake DB match row that mimics what the Supabase query returns
 * (including JOINed league, home_team, away_team objects).
 */
function makeFakeMatch(overrides = {}) {
  return {
    id: '123456',
    league_id: 39,
    season: 2026,
    round: 'Regular Season - 28',
    home_team_id: 33,
    away_team_id: 34,
    date: '2026-06-23T15:00:00.000Z',
    status: 'finished',
    home_score: 2,
    away_score: 1,
    minute: null,
    elapsed: null,
    is_knockout: false,
    venue: 'Old Trafford',
    league: { id: 1, name: 'Premier League', logo: 'https://example.com/pl.png', api_id: 39 },
    home_team: { id: 10, name: 'Manchester United', logo: 'https://example.com/mun.png', api_id: 33 },
    away_team: { id: 20, name: 'Liverpool', logo: 'https://example.com/liv.png', api_id: 34 },
    ...overrides,
  };
}

/**
 * Create a fake live match row (status='live' with minute).
 */
function makeFakeLiveMatch(overrides = {}) {
  return makeFakeMatch({
    status: 'live',
    minute: 67,
    home_score: 1,
    away_score: 0,
    ...overrides,
  });
}

/**
 * Create a fake standings row.
 */
function makeFakeStanding(overrides = {}) {
  return {
    id: 1,
    league_id: 1,
    season: 2026,
    group_name: 'A',
    team_id: 10,
    rank: 1,
    points: 9,
    played: 3,
    wins: 3,
    draws: 0,
    losses: 0,
    goals_for: 8,
    goals_against: 2,
    goal_diff: 6,
    form: 'W,W,W',
    team: { id: 10, name: 'Uruguay', logo: 'https://example.com/uru.png', api_id: 10 },
    ...overrides,
  };
}

/**
 * Create a fake bracket node row.
 */
function makeFakeBracketNode(overrides = {}) {
  return {
    id: 'M73',
    round: 'R32',
    round_index: 0,
    matchup_index: 0,
    home_source: '2°A',
    away_source: '2°B',
    is_third_place: false,
    candidate_groups: null,
    grid_row_start: 2,
    grid_row_span: 2,
    grid_col: 1,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('supabaseAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-wire chain methods after clearAllMocks resets them
    chain.select.mockReturnValue(chain);
    chain.gte.mockReturnValue(chain);
    chain.lt.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);

    // Reset destructure targets to empty/null by default
    chain.data = [];
    chain.error = null;
  });

  // ── R2: getMatches(date) ─────────────────────────────────────────────────

  describe('getMatches(date)', () => {
    it('returns normalized matches for a given date', async () => {
      chain.data = [makeFakeMatch()];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));

      // Verify supabase client was called correctly
      expect(mockFrom).toHaveBeenCalledWith('matches');
      expect(chain.select).toHaveBeenCalled();
      expect(chain.gte).toHaveBeenCalled();
      expect(chain.lt).toHaveBeenCalled();
      expect(chain.order).toHaveBeenCalledWith('date');

      // Verify normalized shape
      expect(result).toHaveLength(1);
      const m = result[0];
      expect(m.id).toBe('123456');
      expect(m.title).toBe('Manchester United vs Liverpool');
      expect(typeof m.date).toBe('number');
      expect(m.league).toBe('Premier League');
      expect(m.leagueId).toBe(39);
      expect(m.competitionCode).toBeNull();
      expect(m.stage).toBeNull();

      // Teams
      expect(m.teams.home.name).toBe('Manchester United');
      expect(m.teams.home.badge).toBe('https://example.com/mun.png');
      expect(m.teams.home.id).toBe(33);
      expect(m.teams.away.name).toBe('Liverpool');
      expect(m.teams.away.badge).toBe('https://example.com/liv.png');
      expect(m.teams.away.id).toBe(34);

      // Status & score
      expect(m.status).toBe('finished');
      expect(m.score.home).toBe(2);
      expect(m.score.away).toBe(1);

      // Other fields
      expect(m.minute).toBeNull();
      expect(m.round).toBe('Regular Season - 28');
      expect(m.matchday).toBeNull();
      expect(m.isKnockout).toBe(false);
      expect(m.season).toBe(2026);
    });

    it('normalizes live match data correctly', async () => {
      chain.data = [makeFakeLiveMatch()];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('live');
      expect(result[0].minute).toBe(67);
      expect(result[0].score.home).toBe(1);
      expect(result[0].score.away).toBe(0);
    });

    it('filters matches by local date (timezone-safe)', async () => {
      // Match with timestamp that has Jun 23 date components in any timezone
      // 2026-06-23 12:00 UTC will be Jun 23 in ALL timezones (UTC-12 to UTC+12)
      chain.data = [
        makeFakeMatch({ id: '1', date: '2026-06-23T12:00:00.000Z' }),
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));
      expect(result).toHaveLength(1);
    });

    it('excludes matches from adjacent local dates', async () => {
      // Match at 2026-06-24 12:00 UTC — definitely Jun 24 in all timezones
      chain.data = [
        makeFakeMatch({ id: '1', date: '2026-06-24T12:00:00.000Z' }),
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));

      // Jun 24 != Jun 23 in ALL timezones
      expect(result).toHaveLength(0);
    });

    it('returns empty array when no matches found', async () => {
      chain.data = [];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));

      expect(result).toEqual([]);
    });

    it('throws on query error', async () => {
      chain.data = null;
      chain.error = { message: 'Connection failed' };

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      await expect(
        supabaseAdapter.getMatches(new Date(2026, 5, 23))
      ).rejects.toThrow('Supabase query error: Connection failed');
    });
  });

  // ── R3: getLiveMatches() ─────────────────────────────────────────────────

  describe('getLiveMatches()', () => {
    it('returns only live matches', async () => {
      chain.data = [makeFakeLiveMatch({ id: '1' }), makeFakeLiveMatch({ id: '2' })];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getLiveMatches();

      expect(mockFrom).toHaveBeenCalledWith('matches');
      expect(chain.eq).toHaveBeenCalledWith('status', 'live');
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('live');
    });

    it('returns empty array when no live matches', async () => {
      chain.data = [];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getLiveMatches();

      expect(result).toEqual([]);
    });

    it('throws on query error', async () => {
      chain.data = null;
      chain.error = { message: 'DB timeout' };

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      await expect(supabaseAdapter.getLiveMatches()).rejects.toThrow(
        'Supabase query error: DB timeout'
      );
    });
  });

  // ── R4: getStandings(leagueId, season) ───────────────────────────────────

  describe('getStandings(leagueId, season)', () => {
    it('returns standings grouped by group_name', async () => {
      chain.data = [
        makeFakeStanding({ rank: 1, points: 9, team: { name: 'Uruguay', logo: 'https://example.com/uru.png', api_id: 10 } }),
        makeFakeStanding({ rank: 2, points: 6, team: { name: 'Argentina', logo: 'https://example.com/arg.png', api_id: 11 } }),
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getStandings(1, 2026);

      expect(mockFrom).toHaveBeenCalledWith('standings');
      expect(chain.eq).toHaveBeenCalledWith('league.api_id', 1);
      expect(chain.eq).toHaveBeenCalledWith('season', 2026);

      expect(result).toHaveLength(1);
      expect(result[0].group).toBe('A');

      const teams = result[0].teams;
      expect(teams).toHaveLength(2);

      // Check first team shape (exact match)
      expect(teams[0]).toEqual({
        rank: 1,
        name: 'Uruguay',
        logo: 'https://example.com/uru.png',
        teamId: 10,
        points: 9,
        played: 3,
        wins: 3,
        draws: 0,
        losses: 0,
        goalsFor: 8,
        goalsAgainst: 2,
        goalDiff: 6,
      });
    });

    it('handles multiple groups', async () => {
      chain.data = [
        makeFakeStanding({ group_name: 'A', rank: 1, team: { name: 'Uruguay', api_id: 10 } }),
        makeFakeStanding({ group_name: 'B', rank: 1, team: { name: 'Brasil', api_id: 20 } }),
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getStandings(1, 2026);

      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('A');
      expect(result[1].group).toBe('B');
    });

    it('handles missing team join gracefully', async () => {
      chain.data = [
        {
          ...makeFakeStanding(),
          team: null, // Simulate missing FK / no matching team
        },
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getStandings(1, 2026);

      expect(result[0].teams[0].name).toBe('N/A');
      expect(result[0].teams[0].logo).toBe('');
      expect(result[0].teams[0].teamId).toBe(10); // falls back to raw team_id
    });

    it('returns empty array when no standings', async () => {
      chain.data = [];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getStandings(1, 2026);

      expect(result).toEqual([]);
    });

    it('throws on query error', async () => {
      chain.data = null;
      chain.error = { message: 'Standings query failed' };

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      await expect(supabaseAdapter.getStandings(1, 2026)).rejects.toThrow(
        'Supabase query error: Standings query failed'
      );
    });
  });

  // ── R5: getBracketNodes() ────────────────────────────────────────────────

  describe('getBracketNodes()', () => {
    it('returns all bracket nodes ordered by round_index, matchup_index', async () => {
      chain.data = [
        makeFakeBracketNode({ id: 'M73', round_index: 0, matchup_index: 0 }),
        makeFakeBracketNode({ id: 'M74', round_index: 0, matchup_index: 1 }),
        makeFakeBracketNode({ id: 'R16-M1', round_index: 1, matchup_index: 0 }),
      ];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getBracketNodes();

      expect(mockFrom).toHaveBeenCalledWith('bracket_nodes');
      expect(chain.order).toHaveBeenCalledWith('round_index');
      expect(chain.order).toHaveBeenCalledWith('matchup_index');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('M73');
      expect(result[0].round).toBe('R32');
      expect(result[0].round_index).toBe(0);
      expect(result[0].matchup_index).toBe(0);
      expect(result[0].is_third_place).toBe(false);
    });

    it('returns empty array when no bracket nodes', async () => {
      chain.data = [];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getBracketNodes();

      expect(result).toEqual([]);
    });

    it('throws on query error', async () => {
      chain.data = null;
      chain.error = { message: 'Bracket query failed' };

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      await expect(supabaseAdapter.getBracketNodes()).rejects.toThrow(
        'Supabase query error: Bracket query failed'
      );
    });
  });

  // ── Shape Contract Tests ─────────────────────────────────────────────────

  describe('Match[] shape contract', () => {
    it('produces all required fields in the correct types', async () => {
      chain.data = [makeFakeMatch()];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));
      const m = result[0];

      // Field presence and type checks
      expect(m).toHaveProperty('id');
      expect(typeof m.id).toBe('string');

      expect(m).toHaveProperty('title');
      expect(typeof m.title).toBe('string');

      expect(m).toHaveProperty('date');
      expect(typeof m.date).toBe('number');

      expect(m).toHaveProperty('league');
      expect(typeof m.league).toBe('string');

      expect(m).toHaveProperty('leagueId');
      expect(typeof m.leagueId).toBe('number');

      expect(m).toHaveProperty('teams');
      expect(m.teams).toHaveProperty('home');
      expect(m.teams.home).toHaveProperty('name');
      expect(m.teams.home).toHaveProperty('badge');
      expect(m.teams.home).toHaveProperty('id');
      expect(m.teams).toHaveProperty('away');
      expect(m.teams.away).toHaveProperty('name');
      expect(m.teams.away).toHaveProperty('badge');
      expect(m.teams.away).toHaveProperty('id');

      expect(m).toHaveProperty('status');
      expect(['pending', 'live', 'finished']).toContain(m.status);

      expect(m).toHaveProperty('score');
      expect(m.score).toHaveProperty('home');
      expect(m.score).toHaveProperty('away');

      expect(m).toHaveProperty('minute');
      expect(m).toHaveProperty('round');
      expect(m).toHaveProperty('isKnockout');
      expect(typeof m.isKnockout).toBe('boolean');

      expect(m).toHaveProperty('season');
    });

    it('handles nullable score fields (pending match)', async () => {
      chain.data = [makeFakeMatch({
        status: 'pending',
        home_score: null,
        away_score: null,
        minute: null,
      })];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));
      const m = result[0];

      expect(m.status).toBe('pending');
      expect(m.score.home).toBeNull();
      expect(m.score.away).toBeNull();
      expect(m.minute).toBeNull();
    });

    it('handles missing JOIN data gracefully (null league/teams)', async () => {
      chain.data = [makeFakeMatch({
        league: null,
        home_team: null,
        away_team: null,
      })];

      const { supabaseAdapter } = await import('../supabaseAdapter.js');
      const result = await supabaseAdapter.getMatches(new Date(2026, 5, 23));
      const m = result[0];

      expect(m.league).toBe('Otros');
      expect(m.teams.home.name).toBe('N/A');
      expect(m.teams.home.badge).toBe('');
      expect(m.teams.home.id).toBe(33); // falls back to home_team_id
      expect(m.teams.away.name).toBe('N/A');
      expect(m.teams.away.badge).toBe('');
      expect(m.teams.away.id).toBe(34); // falls back to away_team_id
    });
  });
});
