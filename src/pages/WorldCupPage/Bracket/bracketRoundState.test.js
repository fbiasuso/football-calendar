// Unit tests for computeRoundStates
import { describe, it, expect } from 'vitest';
import { computeRoundStates } from './Bracket.jsx';
import { TOURNAMENT_GRAPH } from './bracketGraph.js';

// Helper: build a full 32-slot wcSlots object
function makeFullSlots() {
  const r32Ids = Object.entries(TOURNAMENT_GRAPH)
    .filter(([, node]) => node.round === 'R32')
    .map(([id]) => id);
  const slots = {};
  for (const id of r32Ids) {
    slots[`${id}-home`] = { name: 'Team', logo: null, group: 'A' };
    slots[`${id}-away`] = { name: 'Team', logo: null, group: 'B' };
  }
  return slots;
}

describe('computeRoundStates', () => {
  it('should return R32 active when picks and slots are empty', () => {
    const states = computeRoundStates({}, TOURNAMENT_GRAPH, {});
    expect(states).toEqual({
      R32: 'active',
      R16: 'locked',
      QF: 'locked',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should complete R32 and unlock R16 when all R32 picks exist (slots optional)', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const picks = Object.fromEntries(r32Ids.map((id) => [id, 'home']));

    // Full picks, no slots → R32 completed, R16 active (slots not required)
    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, {});
    expect(states.R32).toBe('completed');
    expect(states.R16).toBe('active');
  });

  it('should return R32 completed and R16 active when all slots and R32 picks are done', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const picks = Object.fromEntries(r32Ids.map((id) => [id, 'home']));
    const slots = makeFullSlots();

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, slots);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'active',
      QF: 'locked',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should return R32 and R16 completed when all slots + R32+R16 picks done', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const r16Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R16')
      .map(([id]) => id);
    const picks = Object.fromEntries(
      [...r32Ids, ...r16Ids].map((id) => [id, 'home']),
    );
    const slots = makeFullSlots();

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, slots);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'completed',
      QF: 'active',
      SF: 'locked',
      F: 'locked',
    });
  });

  it('should return all completed when slots full + every node has a pick', () => {
    const picks = Object.fromEntries(
      Object.keys(TOURNAMENT_GRAPH).map((id) => [id, 'home']),
    );
    const slots = makeFullSlots();

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, slots);
    expect(states).toEqual({
      R32: 'completed',
      R16: 'completed',
      QF: 'completed',
      SF: 'completed',
      F: 'completed',
    });
  });

  it('should complete R32 with full picks even with partial slots', () => {
    const r32Ids = Object.entries(TOURNAMENT_GRAPH)
      .filter(([, node]) => node.round === 'R32')
      .map(([id]) => id);
    const picks = Object.fromEntries(r32Ids.map((id) => [id, 'home']));

    // Only 31 out of 32 slots filled — slots not required, R32 completes
    const slots = makeFullSlots();
    delete slots['M73-home'];

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, slots);
    expect(states.R32).toBe('completed');
    expect(states.R16).toBe('active');
  });

  it('should return R32 active with partial R32 picks even with full slots', () => {
    const picks = { M73: 'home', M74: 'away' }; // Only 2 out of 16
    const slots = makeFullSlots();

    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, slots);
    expect(states.R32).toBe('active');
    expect(states.R16).toBe('locked');
  });

  it('should handle null wcSlots gracefully (backwards compat)', () => {
    const picks = { M73: 'home' };
    const states = computeRoundStates(picks, TOURNAMENT_GRAPH, null);
    // With null wcSlots, all32SlotsFilled is false → R32 stays active
    expect(states.R32).toBe('active');
    expect(states.R16).toBe('locked');
  });

  it('should handle undefined wcSlots gracefully', () => {
    const picks = { M73: 'home' };
    const states = computeRoundStates(picks, TOURNAMENT_GRAPH);
    expect(states.R32).toBe('active');
  });
});
