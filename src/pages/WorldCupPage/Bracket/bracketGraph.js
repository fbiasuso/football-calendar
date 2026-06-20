// bracketGraph.js - World Cup 2026 Tournament DAG
//
// 31 nodes total:
//   R32: M73-M88 (16 matchups)
//   R16: R16-M1 to R16-M8 (8 matchups)
//   QF:  QF-M1 to QF-M4 (4 matchups)
//   SF:  SF-M1, SF-M2 (2 matchups)
//   F:   F-M1 (1 matchup)

/**
 * Tournament graph — directed acyclic graph of 31 matchups.
 *
 * Each node:
 *   round:     'R32' | 'R16' | 'QF' | 'SF' | 'F'
 *   feedsInto: the node whose home/away is fed by this node's winner (null for F-M1)
 *   as:        'home' | 'away' — which side this node's winner becomes in the next round
 */
export const TOURNAMENT_GRAPH = {
  // ── R32 → R16 ──────────────────────────────────
  // Pair 1: M74 + M77 → R16-M1
  'M74':    { round: 'R32', feedsInto: 'R16-M1', as: 'home' },
  'M77':    { round: 'R32', feedsInto: 'R16-M1', as: 'away' },
  // Pair 2: M73 + M75 → R16-M2
  'M73':    { round: 'R32', feedsInto: 'R16-M2', as: 'home' },
  'M75':    { round: 'R32', feedsInto: 'R16-M2', as: 'away' },
  // Pair 3: M83 + M84 → R16-M3
  'M83':    { round: 'R32', feedsInto: 'R16-M3', as: 'home' },
  'M84':    { round: 'R32', feedsInto: 'R16-M3', as: 'away' },
  // Pair 4: M81 + M82 → R16-M4
  'M81':    { round: 'R32', feedsInto: 'R16-M4', as: 'home' },
  'M82':    { round: 'R32', feedsInto: 'R16-M4', as: 'away' },
  // Pair 5: M76 + M78 → R16-M5
  'M76':    { round: 'R32', feedsInto: 'R16-M5', as: 'home' },
  'M78':    { round: 'R32', feedsInto: 'R16-M5', as: 'away' },
  // Pair 6: M79 + M80 → R16-M6
  'M79':    { round: 'R32', feedsInto: 'R16-M6', as: 'home' },
  'M80':    { round: 'R32', feedsInto: 'R16-M6', as: 'away' },
  // Pair 7: M86 + M88 → R16-M7
  'M86':    { round: 'R32', feedsInto: 'R16-M7', as: 'home' },
  'M88':    { round: 'R32', feedsInto: 'R16-M7', as: 'away' },
  // Pair 8: M85 + M87 → R16-M8
  'M85':    { round: 'R32', feedsInto: 'R16-M8', as: 'home' },
  'M87':    { round: 'R32', feedsInto: 'R16-M8', as: 'away' },

  // ── R16 → QF ───────────────────────────────────
  'R16-M1': { round: 'R16', feedsInto: 'QF-M1', as: 'home' },
  'R16-M2': { round: 'R16', feedsInto: 'QF-M1', as: 'away' },
  'R16-M3': { round: 'R16', feedsInto: 'QF-M2', as: 'home' },
  'R16-M4': { round: 'R16', feedsInto: 'QF-M2', as: 'away' },
  'R16-M5': { round: 'R16', feedsInto: 'QF-M3', as: 'home' },
  'R16-M6': { round: 'R16', feedsInto: 'QF-M3', as: 'away' },
  'R16-M7': { round: 'R16', feedsInto: 'QF-M4', as: 'home' },
  'R16-M8': { round: 'R16', feedsInto: 'QF-M4', as: 'away' },

  // ── QF → SF ────────────────────────────────────
  'QF-M1':  { round: 'QF', feedsInto: 'SF-M1', as: 'home' },
  'QF-M2':  { round: 'QF', feedsInto: 'SF-M1', as: 'away' },
  'QF-M3':  { round: 'QF', feedsInto: 'SF-M2', as: 'home' },
  'QF-M4':  { round: 'QF', feedsInto: 'SF-M2', as: 'away' },

  // ── SF → Final ─────────────────────────────────
  'SF-M1':  { round: 'SF', feedsInto: 'F-M1', as: 'home' },
  'SF-M2':  { round: 'SF', feedsInto: 'F-M1', as: 'away' },

  // ── Final ──────────────────────────────────────
  'F-M1':   { round: 'F', feedsInto: null, as: null },
};

/**
 * R32 pairs in visual bracket order (top → bottom).
 * Each pair feeds into one R16 matchup.
 */
export const R32_PAIRS = [
  ['M74', 'M77'],  // → R16-M1
  ['M73', 'M75'],  // → R16-M2
  ['M83', 'M84'],  // → R16-M3
  ['M81', 'M82'],  // → R16-M4
  ['M76', 'M78'],  // → R16-M5
  ['M79', 'M80'],  // → R16-M6
  ['M86', 'M88'],  // → R16-M7
  ['M85', 'M87'],  // → R16-M8
];

/**
 * Flattened R32 visual order for easy lookup.
 */
export const R32_ORDER = R32_PAIRS.flat();

/**
 * Verify the graph is acyclic and has exactly 31 nodes.
 * Used internally for validation.
 */
export function validateGraph() {
  const ids = Object.keys(TOURNAMENT_GRAPH);
  if (ids.length !== 31) return false;

  // Every node except F-M1 must feed into exactly one next-round node
  for (const [id, node] of Object.entries(TOURNAMENT_GRAPH)) {
    if (id === 'F-M1' && node.feedsInto !== null) return false;
    if (id !== 'F-M1' && !node.feedsInto) return false;
    if (id !== 'F-M1' && !node.as) return false;
  }

  // Verify round progression
  const roundOrder = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
  for (const [, node] of Object.entries(TOURNAMENT_GRAPH)) {
    if (node.feedsInto) {
      const target = TOURNAMENT_GRAPH[node.feedsInto];
      if (!target) return false;
      if (roundOrder[target.round] !== roundOrder[node.round] + 1) return false;
    }
  }

  // Verify exact counts per round
  const counts = { R32: 0, R16: 0, QF: 0, SF: 0, F: 0 };
  for (const [, node] of Object.entries(TOURNAMENT_GRAPH)) {
    counts[node.round]++;
  }
  if (counts.R32 !== 16) return false;
  if (counts.R16 !== 8) return false;
  if (counts.QF !== 4) return false;
  if (counts.SF !== 2) return false;
  if (counts.F !== 1) return false;

  return true;
}
