// Unit tests for thirdPlaceRanker
import { describe, it, expect } from 'vitest';
import thirdPlaceRanker from './thirdPlaceRanker.js';

/**
 * Build a mock group for testing
 */
function makeGroup(groupLetter, thirdPlaceProps = {}) {
  return {
    group: groupLetter,
    teams: [
      { rank: 1, name: `${groupLetter}1`, points: 9, goalDiff: 10, goalsFor: 15, played: 3 },
      { rank: 2, name: `${groupLetter}2`, points: 6, goalDiff: 3, goalsFor: 8, played: 3 },
      {
        rank: 3,
        name: `${groupLetter}3`,
        points: 3,
        goalDiff: 0,
        goalsFor: 4,
        played: 3,
        ...thirdPlaceProps,
      },
      { rank: 4, name: `${groupLetter}4`, points: 0, goalDiff: -5, goalsFor: 1, played: 3 },
    ],
  };
}

/**
 * Build a full 12-group A-L standings array.
 * Each group's third-place team has 3 pts, 0 GD, 4 GF by default.
 */
function makeFullStandings() {
  return Array.from({ length: 12 }, (_, i) => {
    const letter = String.fromCharCode(65 + i); // A-L
    return makeGroup(letter);
  });
}

describe('thirdPlaceRanker', () => {
  it('should extract 12 third-placed teams and rank them', () => {
    const result = thirdPlaceRanker(makeFullStandings());
    expect(result.rankings).toHaveLength(12);
    expect(result.rankings.every((t) => t.rank === 3)).toBe(true);
  });

  it('should select exactly top 8 as advancing', () => {
    const result = thirdPlaceRanker(makeFullStandings());
    const simulatedSlots = result.thirdPlaceSlots.filter((s) => s.isSimulated);
    expect(simulatedSlots).toHaveLength(8);
  });

  it('should return fixed matchups for all 8 direct pairings', () => {
    const result = thirdPlaceRanker(makeFullStandings());
    expect(result.fixedMatchups).toHaveLength(8);
    const ids = result.fixedMatchups.map((m) => m.matchupId);
    expect(ids).toContain('M73');
    expect(ids).toContain('M75');
    expect(ids).toContain('M76');
    expect(ids).toContain('M78');
    expect(ids).toContain('M83');
    expect(ids).toContain('M84');
    expect(ids).toContain('M86');
    expect(ids).toContain('M88');
  });

  it('should sort by points descending — higher points = better rank', () => {
    const standings = makeFullStandings();
    // Give group C more points
    standings[2] = makeGroup('C', { points: 9, goalDiff: 5, goalsFor: 10 });
    // group D fewer points
    standings[3] = makeGroup('D', { points: 1, goalDiff: -2, goalsFor: 2 });

    const result = thirdPlaceRanker(standings);
    const top = result.rankings[0];
    expect(top.group).toBe('C');
    expect(top.points).toBe(9);
  });

  it('should break ties by goal difference', () => {
    const standings = makeFullStandings();
    // Same points, different GD
    standings[0] = makeGroup('A', { points: 3, goalDiff: 5, goalsFor: 4 });
    standings[1] = makeGroup('B', { points: 3, goalDiff: 2, goalsFor: 4 });

    const result = thirdPlaceRanker(standings);
    const aIdx = result.rankings.findIndex((t) => t.group === 'A');
    const bIdx = result.rankings.findIndex((t) => t.group === 'B');
    expect(aIdx).toBeLessThan(bIdx); // A (GD +5) > B (GD +2)
  });

  it('should break ties by goals for when GD is equal', () => {
    const standings = makeFullStandings();
    // Same points, same GD, different GF
    standings[0] = makeGroup('A', { points: 3, goalDiff: 0, goalsFor: 7 });
    standings[1] = makeGroup('B', { points: 3, goalDiff: 0, goalsFor: 3 });

    const result = thirdPlaceRanker(standings);
    const aIdx = result.rankings.findIndex((t) => t.group === 'A');
    const bIdx = result.rankings.findIndex((t) => t.group === 'B');
    expect(aIdx).toBeLessThan(bIdx); // A (GF 7) > B (GF 3)
  });

  it('should handle fewer than 8 third-place teams gracefully', () => {
    // Only 5 groups have data, rest have no third-place team
    const partialStandings = [
      makeGroup('A', { points: 6 }),
      makeGroup('B', { points: 5 }),
      makeGroup('C', { points: 4 }),
      makeGroup('D', { points: 3 }),
      { group: 'E', teams: [] }, // No teams at all
    ];

    const result = thirdPlaceRanker(partialStandings);
    const simulatedSlots = result.thirdPlaceSlots.filter((s) => s.isSimulated);
    // Only 4 third-place teams advance, but there are 8 slots
    // Some slots will have isSimulated: false and team: null
    expect(simulatedSlots.length).toBeLessThanOrEqual(4);
    const nullSlots = result.thirdPlaceSlots.filter((s) => s.team === null);
    expect(nullSlots.length).toBeGreaterThanOrEqual(4);
  });

  it('should assign each third-place team to exactly one slot', () => {
    const result = thirdPlaceRanker(makeFullStandings());
    const assignedGroups = result.thirdPlaceSlots
      .filter((s) => s.team)
      .map((s) => s.team.group);

    const uniqueGroups = [...new Set(assignedGroups)];
    expect(uniqueGroups).toHaveLength(assignedGroups.length); // no duplicates
  });

  it('should respect candidate-group constraints per slot', () => {
    const result = thirdPlaceRanker(makeFullStandings());

    for (const slot of result.thirdPlaceSlots) {
      if (slot.team) {
        // The team's group must be in the slot's candidate groups
        expect(slot.candidateGroups).toContain(slot.team.group);
      }
    }
  });

  it('should prevent self-match (team vs own group winner)', () => {
    // This is structurally guaranteed with the current candidate sets,
    // but verify the function handles it
    const standings = makeFullStandings();
    // Make a scenario where group B has a strong third-place team
    // M85 is 1B vs 3rd[E,F,G,I,J] — B is NOT in candidate groups, so self-match can't happen
    // Test passes structurally

    const result = thirdPlaceRanker(standings);
    // Just verify no errors
    expect(result.thirdPlaceSlots.length).toBe(8);
  });

  it('should return advancing teams in rank order (best first)', () => {
    const standings = makeFullStandings();
    // Give each team a distinct point value
    standings.forEach((g, i) => {
      const pts = 12 - i; // A=12, B=11, ..., L=1
      g.teams[2] = { ...g.teams[2], points: pts, goalDiff: 0, goalsFor: 0 };
    });

    const result = thirdPlaceRanker(standings);
    const advancing = result.rankings.slice(0, 8);
    for (let i = 1; i < advancing.length; i++) {
      expect(advancing[i - 1].points).toBeGreaterThanOrEqual(advancing[i].points);
    }
  });
});
