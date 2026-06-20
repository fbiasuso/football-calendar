// Unit tests for bracketGraph.js
import { describe, it, expect } from 'vitest';
import { TOURNAMENT_GRAPH, R32_PAIRS, R32_ORDER, validateGraph } from './bracketGraph.js';

describe('TOURNAMENT_GRAPH', () => {
  it('should have exactly 31 nodes', () => {
    const ids = Object.keys(TOURNAMENT_GRAPH);
    expect(ids).toHaveLength(31);
  });

  it('should have 16 R32 matchups (M73–M88)', () => {
    const r32 = Object.entries(TOURNAMENT_GRAPH).filter(([, n]) => n.round === 'R32');
    expect(r32).toHaveLength(16);
    const ids = r32.map(([id]) => id).sort();
    expect(ids[0]).toBe('M73');
    expect(ids[ids.length - 1]).toBe('M88');
  });

  it('should have 8 R16 matchups (R16-M1 to R16-M8)', () => {
    const r16 = Object.entries(TOURNAMENT_GRAPH).filter(([, n]) => n.round === 'R16');
    expect(r16).toHaveLength(8);
    const ids = r16.map(([id]) => id).sort();
    expect(ids[0]).toBe('R16-M1');
    expect(ids[ids.length - 1]).toBe('R16-M8');
  });

  it('should have 4 QF matchups (QF-M1 to QF-M4)', () => {
    const qf = Object.entries(TOURNAMENT_GRAPH).filter(([, n]) => n.round === 'QF');
    expect(qf).toHaveLength(4);
    const ids = qf.map(([id]) => id).sort();
    expect(ids[0]).toBe('QF-M1');
    expect(ids[ids.length - 1]).toBe('QF-M4');
  });

  it('should have 2 SF matchups (SF-M1, SF-M2)', () => {
    const sf = Object.entries(TOURNAMENT_GRAPH).filter(([, n]) => n.round === 'SF');
    expect(sf).toHaveLength(2);
    expect(sf.map(([id]) => id).sort()).toEqual(['SF-M1', 'SF-M2']);
  });

  it('should have 1 Final matchup (F-M1)', () => {
    const f = Object.entries(TOURNAMENT_GRAPH).filter(([, n]) => n.round === 'F');
    expect(f).toHaveLength(1);
    expect(f[0][0]).toBe('F-M1');
  });

  it('should be acyclic (every path ends at F-M1 feedsInto=null)', () => {
    for (const [id] of Object.entries(TOURNAMENT_GRAPH)) {
      const visited = new Set();
      let current = id;
      while (current && !visited.has(current)) {
        visited.add(current);
        const node = TOURNAMENT_GRAPH[current];
        if (!node || !node.feedsInto) break;
        current = node.feedsInto;
      }
      // If we didn't reach null, there's a cycle
      const node = TOURNAMENT_GRAPH[current];
      expect(node === undefined || node.feedsInto === null).toBe(true);
    }
  });

  it('should progress through rounds correctly (R32→R16→QF→SF→F)', () => {
    const roundOrder = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
    for (const [id, node] of Object.entries(TOURNAMENT_GRAPH)) {
      if (node.feedsInto) {
        const target = TOURNAMENT_GRAPH[node.feedsInto];
        expect(target).toBeDefined();
        expect(roundOrder[target.round]).toBe(roundOrder[node.round] + 1);
      }
    }
  });

  it('should have F-M1 with feedsInto=null and as=null', () => {
    const final = TOURNAMENT_GRAPH['F-M1'];
    expect(final.feedsInto).toBeNull();
    expect(final.as).toBeNull();
  });

  it('should correctly map R32 matchups to their R16 targets', () => {
    // M74+M77 → R16-M1
    expect(TOURNAMENT_GRAPH['M74'].feedsInto).toBe('R16-M1');
    expect(TOURNAMENT_GRAPH['M74'].as).toBe('home');
    expect(TOURNAMENT_GRAPH['M77'].feedsInto).toBe('R16-M1');
    expect(TOURNAMENT_GRAPH['M77'].as).toBe('away');

    // M73+M75 → R16-M2
    expect(TOURNAMENT_GRAPH['M73'].feedsInto).toBe('R16-M2');
    expect(TOURNAMENT_GRAPH['M73'].as).toBe('home');
    expect(TOURNAMENT_GRAPH['M75'].feedsInto).toBe('R16-M2');
    expect(TOURNAMENT_GRAPH['M75'].as).toBe('away');

    // M83+M84 → R16-M3
    expect(TOURNAMENT_GRAPH['M83'].feedsInto).toBe('R16-M3');
    expect(TOURNAMENT_GRAPH['M84'].feedsInto).toBe('R16-M3');
    expect(TOURNAMENT_GRAPH['M83'].as).toBe('home');
    expect(TOURNAMENT_GRAPH['M84'].as).toBe('away');
  });

  it('should correctly map R16 matchups to their QF targets', () => {
    // R16-M1+R16-M2 → QF-M1
    expect(TOURNAMENT_GRAPH['R16-M1'].feedsInto).toBe('QF-M1');
    expect(TOURNAMENT_GRAPH['R16-M2'].feedsInto).toBe('QF-M1');
    expect(TOURNAMENT_GRAPH['R16-M1'].as).toBe('home');
    expect(TOURNAMENT_GRAPH['R16-M2'].as).toBe('away');

    // R16-M3+R16-M4 → QF-M2
    expect(TOURNAMENT_GRAPH['R16-M3'].feedsInto).toBe('QF-M2');
    expect(TOURNAMENT_GRAPH['R16-M4'].feedsInto).toBe('QF-M2');
  });

  it('should correctly map QF to SF', () => {
    expect(TOURNAMENT_GRAPH['QF-M1'].feedsInto).toBe('SF-M1');
    expect(TOURNAMENT_GRAPH['QF-M2'].feedsInto).toBe('SF-M1');
    expect(TOURNAMENT_GRAPH['QF-M3'].feedsInto).toBe('SF-M2');
    expect(TOURNAMENT_GRAPH['QF-M4'].feedsInto).toBe('SF-M2');
  });

  it('should correctly map SF to Final', () => {
    expect(TOURNAMENT_GRAPH['SF-M1'].feedsInto).toBe('F-M1');
    expect(TOURNAMENT_GRAPH['SF-M2'].feedsInto).toBe('F-M1');
    expect(TOURNAMENT_GRAPH['SF-M1'].as).toBe('home');
    expect(TOURNAMENT_GRAPH['SF-M2'].as).toBe('away');
  });
});

describe('R32_PAIRS', () => {
  it('should have exactly 8 pairs', () => {
    expect(R32_PAIRS).toHaveLength(8);
  });

  it('each pair should have exactly 2 matchup IDs', () => {
    R32_PAIRS.forEach((pair) => {
      expect(pair).toHaveLength(2);
    });
  });

  it('should match the specified visual order', () => {
    const expected = [
      ['M74', 'M77'],
      ['M73', 'M75'],
      ['M83', 'M84'],
      ['M81', 'M82'],
      ['M76', 'M78'],
      ['M79', 'M80'],
      ['M86', 'M88'],
      ['M85', 'M87'],
    ];
    expect(R32_PAIRS).toEqual(expected);
  });

  it('R32_ORDER should be the flattened array of R32_PAIRS', () => {
    const expected = R32_PAIRS.flat();
    expect(R32_ORDER).toEqual(expected);
  });
});

describe('validateGraph', () => {
  it('should return true for the current graph', () => {
    expect(validateGraph()).toBe(true);
  });
});
