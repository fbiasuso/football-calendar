// Unit tests for computeRoundStates
import { describe, it, expect } from 'vitest';
import { computeRoundStates } from './Bracket.jsx';
import { TOURNAMENT_GRAPH } from './bracketGraph.js';

describe('computeRoundStates', () => {
  it('should return all locked when picks are empty', () => {
    const states = computeRoundStates({}, TOURNAMENT_GRAPH);
    expect(states).toEqual({
      R32: 'active',
      R16: 'locked',
      QF: 'locked',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should return R32 completed and R16 active when only R32 is fully picked', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const picks = Object.fromEntries(r32Ids.map((id) => [id, 'home']));

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'active',
      QF: 'locked',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should return R32 and R16 completed and QF active when R32+R16 are fully picked', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const r16Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R16')
      .map(([id]) => id);
    const picks = Object.fromEntries(
      [...r32Ids, ...r16Ids].map((id) => [id, 'home']),
    );

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'completed',
      QF: 'active',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should return all completed when every node has a pick', () => {
    const picks = Object.fromEntries(
      Object.keys(TOURNAMENT_GRAPH).map((id) => [id, 'home']),
    );

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'completed',
      QF: 'completed',
      SF: 'completed',
      F: 'completed',
    });
  });

  it('should return R32 active when only partial R32 picks exist', () => {
    const picks = { M73: 'home', M74: 'away' }; // Only 2 out of 16 R32

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH);
    expect(states).toEqual({
      R32: 'active',
      R16: 'locked',
      QF: 'locked',
      SF: 'locked',
      F: 'locked',
    });
  });
});
