// Unit tests for bracketEngine.js
import { describe, it, expect } from 'vitest';
import { resolveBracket, isThirdPlaceSlot, getR32Config } from './bracketEngine.js';
import { TOURNAMENT_GRAPH } from './bracketGraph.js';

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Build a mock group with teams.
 */
function makeGroup(letter, thirdPlaceProps = {}) {
  return {
    group: letter,
    teams: [
      { rank: 1, name: `${letter}1`, logo: `logo-${letter}1`, points: 9, goalDiff: 10, goalsFor: 15, played: 3, wins: 3, draws: 0, losses: 0, goalsAgainst: 5 },
      { rank: 2, name: `${letter}2`, logo: `logo-${letter}2`, points: 6, goalDiff: 3, goalsFor: 8, played: 3, wins: 2, draws: 0, losses: 1, goalsAgainst: 5 },
      {
        rank: 3,
        name: `${letter}3`,
        logo: `logo-${letter}3`,
        points: 3,
        goalDiff: 0,
        goalsFor: 4,
        played: 3,
        wins: 1,
        draws: 0,
        losses: 2,
        goalsAgainst: 4,
        ...thirdPlaceProps,
      },
      { rank: 4, name: `${letter}4`, logo: `logo-${letter}4`, points: 0, goalDiff: -5, goalsFor: 1, played: 3, wins: 0, draws: 0, losses: 3, goalsAgainst: 6 },
    ],
  };
}

/**
 * Build a full 12-group standings array (groups A–L).
 */
function makeFullStandings() {
  return Array.from({ length: 12 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return makeGroup(letter);
  });
}

/**
 * Build a mock rankerResult from full standings.
 * Returns the teams+slots in the same format as thirdPlaceRanker.
 */
function makeMockRankerResult(standings) {
  const thirdPlaceTeams = standings
    .map((g) => {
      const t = (g.teams || []).find((x) => x.rank === 3);
      return t ? { ...t, group: g.group } : null;
    })
    .filter(Boolean);

  const ranked = [...thirdPlaceTeams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return (b.goalsFor || 0) - (a.goalsFor || 0);
  });

  const advancing = ranked.slice(0, 8);

  const thirdPlaceSlots = [
    { matchupId: 'M74', team: advancing[0] || null, isSimulated: !!advancing[0] },
    { matchupId: 'M77', team: advancing[1] || null, isSimulated: !!advancing[1] },
    { matchupId: 'M79', team: advancing[2] || null, isSimulated: !!advancing[2] },
    { matchupId: 'M80', team: advancing[3] || null, isSimulated: !!advancing[3] },
    { matchupId: 'M81', team: advancing[4] || null, isSimulated: !!advancing[4] },
    { matchupId: 'M82', team: advancing[5] || null, isSimulated: !!advancing[5] },
    { matchupId: 'M85', team: advancing[6] || null, isSimulated: !!advancing[6] },
    { matchupId: 'M87', team: advancing[7] || null, isSimulated: !!advancing[7] },
  ];

  return { fixedMatchups: [], thirdPlaceSlots, rankings: ranked };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveBracket', () => {
  it('should resolve all 31 matchups with basic data', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);

    const ids = Object.keys(result.matchups);
    expect(ids).toHaveLength(31);
  });

  it('should resolve R32 teams from standings', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);

    // M73: 2°A vs 2°B
    expect(result.matchups['M73'].home.name).toBe('A2');
    expect(result.matchups['M73'].away.name).toBe('B2');

    // M75: 1°F vs 2°C
    expect(result.matchups['M75'].home.name).toBe('F1');
    expect(result.matchups['M75'].away.name).toBe('C2');

    // M74: 1°E vs third-place slot
    expect(result.matchups['M74'].home.name).toBe('E1');
    // Third-place team should be assigned (non-null with full standings)
    expect(result.matchups['M74'].away).not.toBeNull();
  });

  it('should have no winners when no picks are set', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);

    for (const [, matchup] of Object.entries(result.matchups)) {
      expect(matchup.winner).toBeNull();
    }
  });

  it('should have isPending=true for R32 matchups with both teams but no pick', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);

    // Fixed matchups have both teams → isPending true
    expect(result.matchups['M73'].isPending).toBe(true);
    // Third-place slots with team assigned → isPending true
    const someThird = result.matchups['M74'];
    if (someThird.away) {
      expect(someThird.isPending).toBe(true);
    }
  });

  it('should apply picks and set winners on R32 matchups', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const picks = { 'M73': 'home', 'M75': 'away' };
    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    expect(result.matchups['M73'].winner).toBe('home');
    expect(result.matchups['M75'].winner).toBe('away');
  });

  it('should propagate R32 winners to R16 matchups', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // M73: 2°A vs 2°B → pick home (2°A = A2)
    // M75: 1°F vs 2°C → pick away (2°C = C2)
    const picks = { 'M73': 'home', 'M75': 'away' };
    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    // M73 feeds into R16-M2 as home → R16-M2.home = winner of M73 = A2
    // M75 feeds into R16-M2 as away → R16-M2.away = winner of M75 = C2
    expect(result.matchups['R16-M2'].home.name).toBe('A2');
    expect(result.matchups['R16-M2'].away.name).toBe('C2');

    // R16-M2 should have isPending=true (both teams known, no pick)
    expect(result.matchups['R16-M2'].isPending).toBe(true);
  });

  it('should propagate through R16 to QF when picks complete a path', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // Full path: M74 + M77 → R16-M1(home) + M73 + M75 → R16-M2(away) → QF-M1(away)
    // But QF-M1's home comes from R16-M1 which we need to resolve first.
    // Simpler: test R16-M2 → QF-M1 as the away side
    const picks = {
      'M73': 'home',     // A2 wins
      'M75': 'home',     // F1 wins
      'R16-M2': 'home',  // A2 wins → QF-M1.away = A2
      'M74': 'home',     // E1 wins
      'M77': 'home',     // I1 wins
      'R16-M1': 'home',  // E1 wins → QF-M1.home = E1
    };
    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    // QF-M1.home = winner of R16-M1 = E1 (from M74.home)
    expect(result.matchups['QF-M1'].home.name).toBe('E1');
    // QF-M1.away = winner of R16-M2 = A2 (from M73.home)
    expect(result.matchups['QF-M1'].away.name).toBe('A2');
    // Both teams known, no pick yet on QF-M1
    expect(result.matchups['QF-M1'].isPending).toBe(true);
    expect(result.matchups['QF-M1'].winner).toBeNull();
  });

  it('should propagate all the way to F-M1 with full picks on one complete branch', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // Build a complete path through the right half:
    // M73 + M75 → R16-M2, R16-M3 + R16-M4 → QF-M2, QF-M1 + QF-M2 → SF-M1
    // For SF-M1 to be fully resolved, both QF-M1 and QF-M2 need winners.
    // QF-M1 feeds from R16-M1 + R16-M2. QF-M2 feeds from R16-M3 + R16-M4.
    // Let's pick all the way to F-M1 on one path:

    // Left path: M74 + M77 → R16-M1 → QF-M1(home)
    // Right path: M73 + M75 → R16-M2 → QF-M1(away)
    // Other path: M83 + M84 → R16-M3 → QF-M2(home)
    // Another: M81 + M82 → R16-M4 → QF-M2(away)
    // Then QF-M1 + QF-M2 → SF-M1(home)
    // SF-M1 + SF-M2 → F-M1

    // For simplicity, test that picks on SF-M1 propagate correctly.
    // We need both QF-M1 and QF-M2 to have winners.
    const picks = {
      // Left R32 pair → R16-M1 → QF-M1 home
      'M74': 'home', 'M77': 'away', 'R16-M1': 'home',
      // Right R32 pair → R16-M2 → QF-M1 away
      'M73': 'home', 'M75': 'away', 'R16-M2': 'away',
      // QF-M1: pick home (E1 wins)
      'QF-M1': 'home',
      // R32 → R16-M3 → QF-M2 home
      'M83': 'home', 'M84': 'home', 'R16-M3': 'home',
      // R32 → R16-M4 → QF-M2 away
      'M81': 'home', 'M82': 'away', 'R16-M4': 'home',
      // QF-M2: pick away
      'QF-M2': 'away',
      // SF-M1: pick home
      'SF-M1': 'home',
      // SF-M2 needs sides too: QF-M3 + QF-M4
      'M76': 'home', 'M78': 'home', 'R16-M5': 'home',
      'M79': 'home', 'M80': 'away', 'R16-M6': 'away',
      'QF-M3': 'home',
      'M86': 'home', 'M88': 'away', 'R16-M7': 'home',
      'M85': 'home', 'M87': 'away', 'R16-M8': 'away',
      'QF-M4': 'home',
      // SF-M2: pick home
      'SF-M2': 'home',
    };

    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    // Check SF-M1 is properly resolved
    expect(result.matchups['SF-M1'].home.name).toBe('E1'); // QF-M1.home = winner of R16-M1.home = M74.home
    // QF-M1.winner = 'home', so SF-M1.home = QF-M1.home
    // QF-M1.home = winner of R16-M1 = R16-M1.home (pick) = M74.home = E1
    expect(result.matchups['SF-M1'].winner).toBe('home');

    // F-M1 should have both teams
    expect(result.matchups['F-M1'].home).toBe(result.matchups['SF-M1'].home); // SF-M1.home (winner = 'home')
    expect(result.matchups['F-M1'].away).toBe(result.matchups['SF-M2'].home); // SF-M2.home (winner = 'home')
    expect(result.matchups['F-M1'].isPending).toBe(true); // both teams known, no pick on F-M1
  });

  it('should show Pendiente (no team) in R16 when feeder has no winner', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // Only pick M74, not M77 → R16-M1 has only home team
    const picks = { 'M74': 'away' };
    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    // M74.winner = away → R16-M1.home = M74.away (third-place team)
    expect(result.matchups['R16-M1'].home).not.toBeNull();
    // M77 has no winner → R16-M1.away = null
    expect(result.matchups['R16-M1'].away).toBeNull();
    // isPending should be false because not both teams known
    expect(result.matchups['R16-M1'].isPending).toBe(false);
  });

  it('should handle empty standings gracefully', () => {
    const result = resolveBracket({}, TOURNAMENT_GRAPH, [], null);
    expect(result).toBeDefined();
    expect(Object.keys(result.matchups)).toHaveLength(31);
    // All teams should be null
    for (const [, matchup] of Object.entries(result.matchups)) {
      expect(matchup.home).toBeNull();
      expect(matchup.away).toBeNull();
    }
  });

  it('should handle null rankerResult (no standings)', () => {
    const standings = makeFullStandings();
    // Don't include rankerResult at all (null)
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, null);

    // Third-place slots should have null away teams
    expect(result.matchups['M74'].home.name).toBe('E1');
    expect(result.matchups['M74'].away).toBeNull();
    expect(result.matchups['M77'].home.name).toBe('I1');
    expect(result.matchups['M77'].away).toBeNull();
  });

  it('should handle partial picks and maintain DAG consistency', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const picks = {
      'M74': 'away',
      'M77': 'home',
      'R16-M1': 'home',
    };
    const result = resolveBracket(picks, TOURNAMENT_GRAPH, standings, rankerRes);

    // R16-M1.home = winner of M74 = away team of M74 (third place)
    // R16-M1.away = winner of M77 = home team of M77 (1°I = I1)
    expect(result.matchups['R16-M1'].home).toBe(result.matchups['M74'].away);
    expect(result.matchups['R16-M1'].away).toBe(result.matchups['M77'].home);

    // QF-M1.home = winner of R16-M1 = home (since pick is 'home')
    expect(result.matchups['QF-M1'].home).toBe(result.matchups['R16-M1'].home);
    // QF-M1.away = winner of R16-M2 = null (no pick on M73/M75)
    expect(result.matchups['QF-M1'].away).toBeNull();
  });

  it('should have type "third" for third-place slots and "fixed" for fixed matchups', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);

    expect(result.matchups['M74'].type).toBe('third');
    expect(result.matchups['M73'].type).toBe('fixed');
    expect(result.matchups['R16-M1'].type).toBe('resolved');
  });
});

describe('resolveBracket with wcSlots', () => {
  it('should override standings when wcSlots is provided', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    const wcSlots = {
      'M73-home': { name: 'CustomA', logo: 'logo-ca', group: 'A' },
      'M73-away': { name: 'CustomB', logo: 'logo-cb', group: 'B' },
    };
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes, wcSlots);

    expect(result.matchups['M73'].home.name).toBe('CustomA');
    expect(result.matchups['M73'].away.name).toBe('CustomB');
    // Should NOT be the standings defaults (A2, B2)
    expect(result.matchups['M73'].home.name).not.toBe('A2');
    expect(result.matchups['M73'].away.name).not.toBe('B2');
  });

  it('should fall back to standings when wcSlots is empty for a slot', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // Only override M73-home, leave M73-away empty
    const wcSlots = {
      'M73-home': { name: 'CustomA', logo: 'logo-ca', group: 'A' },
    };
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes, wcSlots);

    expect(result.matchups['M73'].home.name).toBe('CustomA');
    // away should fall through to standings (2°B = B2)
    expect(result.matchups['M73'].away.name).toBe('B2');
  });

  it('should handle partial mixed wcSlots with standings and rankerResult', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);
    // Override M73-home, leave other slots untouched
    const wcSlots = {
      'M73-home': { name: 'CustomA', logo: 'logo-ca', group: 'A' },
    };
    const result = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes, wcSlots);

    // M73-home overridden
    expect(result.matchups['M73'].home.name).toBe('CustomA');
    // M73-away from standings
    expect(result.matchups['M73'].away.name).toBe('B2');
    // M74-home from standings (1°E = E1)
    expect(result.matchups['M74'].home.name).toBe('E1');
    // M74-away from rankerResult
    expect(result.matchups['M74'].away).not.toBeNull();
  });

  it('should fall through to standings when wcSlots is null/undefined', () => {
    const standings = makeFullStandings();
    const rankerRes = makeMockRankerResult(standings);

    // No wcSlots arg (undefined)
    const result1 = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes);
    expect(result1.matchups['M73'].home.name).toBe('A2');

    // wcSlots explicitly null
    const result2 = resolveBracket({}, TOURNAMENT_GRAPH, standings, rankerRes, null);
    expect(result2.matchups['M73'].home.name).toBe('A2');
  });
});

describe('isThirdPlaceSlot', () => {
  it('should return true for third-place slots', () => {
    expect(isThirdPlaceSlot('M74')).toBe(true);
    expect(isThirdPlaceSlot('M77')).toBe(true);
    expect(isThirdPlaceSlot('M79')).toBe(true);
    expect(isThirdPlaceSlot('M80')).toBe(true);
    expect(isThirdPlaceSlot('M81')).toBe(true);
    expect(isThirdPlaceSlot('M82')).toBe(true);
    expect(isThirdPlaceSlot('M85')).toBe(true);
    expect(isThirdPlaceSlot('M87')).toBe(true);
  });

  it('should return false for fixed matchups', () => {
    expect(isThirdPlaceSlot('M73')).toBe(false);
    expect(isThirdPlaceSlot('M75')).toBe(false);
    expect(isThirdPlaceSlot('M76')).toBe(false);
    expect(isThirdPlaceSlot('M78')).toBe(false);
    expect(isThirdPlaceSlot('M83')).toBe(false);
    expect(isThirdPlaceSlot('M84')).toBe(false);
    expect(isThirdPlaceSlot('M86')).toBe(false);
    expect(isThirdPlaceSlot('M88')).toBe(false);
  });

  it('should return false for non-R32 matchups', () => {
    expect(isThirdPlaceSlot('R16-M1')).toBe(false);
    expect(isThirdPlaceSlot('QF-M1')).toBe(false);
    expect(isThirdPlaceSlot('SF-M1')).toBe(false);
    expect(isThirdPlaceSlot('F-M1')).toBe(false);
  });
});

describe('getR32Config', () => {
  it('should return config for valid R32 ids', () => {
    const cfg = getR32Config('M74');
    expect(cfg).toBeDefined();
    expect(cfg.id).toBe('M74');
    expect(cfg.type).toBe('third');
    expect(cfg.homeRank).toBe(1);
    expect(cfg.homeGroup).toBe('E');
  });

  it('should return undefined for non-R32 ids', () => {
    expect(getR32Config('R16-M1')).toBeUndefined();
    expect(getR32Config('F-M1')).toBeUndefined();
  });
});
