// bracketEngine.js — Pure bracket resolution engine
//
// resolveBracket(picks, graph, standings, rankerResult)
//   → { matchups: { [id]: { home, away, winner, isPending, type } } }
//
// Resolves teams and winners for all 31 bracket nodes:
//   1. R32 teams are resolved from standings + rankerResult (third-place slots)
//   2. User picks override winners when present
//   3. Winners propagate forward through the DAG

// ── R32 configuration ─────────────────────────────────────────────────────────
// Describes how to resolve home/away teams for each R32 matchup from standings.

/** @type {Array<{id:string, homeRank:number, homeGroup:string, type:string, awayRank?:number, awayGroup?:string}>} */
const R32_CONFIG = [
  // Third-place slots: home from standings, away from rankerResult
  { id: 'M74', homeRank: 1, homeGroup: 'E', type: 'third' },
  { id: 'M77', homeRank: 1, homeGroup: 'I', type: 'third' },
  { id: 'M79', homeRank: 1, homeGroup: 'A', type: 'third' },
  { id: 'M80', homeRank: 1, homeGroup: 'L', type: 'third' },
  { id: 'M81', homeRank: 1, homeGroup: 'D', type: 'third' },
  { id: 'M82', homeRank: 1, homeGroup: 'G', type: 'third' },
  { id: 'M85', homeRank: 1, homeGroup: 'B', type: 'third' },
  { id: 'M87', homeRank: 1, homeGroup: 'K', type: 'third' },
  // Fixed matchups: both teams from standings
  { id: 'M73', homeRank: 2, homeGroup: 'A', awayRank: 2, awayGroup: 'B', type: 'fixed' },
  { id: 'M75', homeRank: 1, homeGroup: 'F', awayRank: 2, awayGroup: 'C', type: 'fixed' },
  { id: 'M76', homeRank: 1, homeGroup: 'C', awayRank: 2, awayGroup: 'F', type: 'fixed' },
  { id: 'M78', homeRank: 2, homeGroup: 'E', awayRank: 2, awayGroup: 'I', type: 'fixed' },
  { id: 'M83', homeRank: 2, homeGroup: 'K', awayRank: 2, awayGroup: 'L', type: 'fixed' },
  { id: 'M84', homeRank: 1, homeGroup: 'H', awayRank: 2, awayGroup: 'J', type: 'fixed' },
  { id: 'M86', homeRank: 1, homeGroup: 'J', awayRank: 2, awayGroup: 'H', type: 'fixed' },
  { id: 'M88', homeRank: 2, homeGroup: 'D', awayRank: 2, awayGroup: 'G', type: 'fixed' },
];

/** R32_CONFIG indexed by id for fast lookup */
const R32_CONFIG_BY_ID = Object.fromEntries(R32_CONFIG.map((c) => [c.id, c]));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up a team from standings by rank and group.
 * @param {Array} standings
 * @param {number} rank
 * @param {string} group
 * @returns {{name:string, logo:string}|null}
 */
function getTeamByRank(standings, rank, group) {
  if (!Array.isArray(standings)) return null;
  const g = standings.find((x) => x.group === group);
  if (!g || !Array.isArray(g.teams)) return null;
  const t = g.teams.find((x) => x.rank === rank);
  return t ? { name: t.name, logo: t.logo } : null;
}

/**
 * Round order for topological traversal.
 */
const ROUND_ORDER = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve the full bracket from standings, third-place ranking, and user picks.
 *
 * @param {Object}               picks         - { [matchupId]: 'home'|'away' }
 * @param {Object}               graph         - TOURNAMENT_GRAPH
 * @param {Array}                standings     - Array<{group, teams}>
 * @param {Object|null}          rankerResult  - Result of thirdPlaceRanker(standings)
 * @returns {{ matchups: Object }}
 */
export function resolveBracket(picks, graph, standings, rankerResult) {
  const matchups = {};

  // ── Step 1: Resolve R32 ─────────────────────────────────────────────────────
  for (const cfg of R32_CONFIG) {
    const home = getTeamByRank(standings, cfg.homeRank, cfg.homeGroup);
    let away = null;

    if (cfg.type === 'fixed') {
      away = getTeamByRank(standings, cfg.awayRank, cfg.awayGroup);
    } else if (rankerResult?.thirdPlaceSlots) {
      const slot = rankerResult.thirdPlaceSlots.find((s) => s.matchupId === cfg.id);
      if (slot?.team) {
        away = { name: slot.team.name, logo: slot.team.logo };
      }
    }

    const winner = picks[cfg.id] || null;

    matchups[cfg.id] = {
      home,
      away,
      winner,
      isPending: !winner && !!(home && away),
      type: cfg.type,
    };
  }

  // ── Step 2: Resolve subsequent rounds topologically ─────────────────────────
  // Collect nodes by round (excluding R32 which is already resolved)
  const byRound = {};
  for (const [id, node] of Object.entries(graph)) {
    if (node.round === 'R32') continue;
    if (!byRound[node.round]) byRound[node.round] = [];
    byRound[node.round].push(id);
  }

  // Process in order: R16 → QF → SF → F
  const rounds = ['R16', 'QF', 'SF', 'F'];
  for (const round of rounds) {
    for (const id of (byRound[round] || [])) {
      // Find which matchups feed into this one
      const feeders = Object.entries(graph).filter(([, n]) => n.feedsInto === id);

      const homeFeeder = feeders.find(([, n]) => n.as === 'home');
      const awayFeeder = feeders.find(([, n]) => n.as === 'away');

      const homeFeederMatchup = homeFeeder ? matchups[homeFeeder[0]] : null;
      const awayFeederMatchup = awayFeeder ? matchups[awayFeeder[0]] : null;

      // Resolve home team: winner of the home feeder matchup
      let homeTeam = null;
      if (homeFeederMatchup?.winner === 'home') homeTeam = homeFeederMatchup.home;
      else if (homeFeederMatchup?.winner === 'away') homeTeam = homeFeederMatchup.away;

      // Resolve away team: winner of the away feeder matchup
      let awayTeam = null;
      if (awayFeederMatchup?.winner === 'home') awayTeam = awayFeederMatchup.home;
      else if (awayFeederMatchup?.winner === 'away') awayTeam = awayFeederMatchup.away;

      const winner = picks[id] || null;

      matchups[id] = {
        home: homeTeam,
        away: awayTeam,
        winner,
        isPending: !winner && !!(homeTeam && awayTeam),
        type: 'resolved',
      };
    }
  }

  return { matchups };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Check if a matchup id is a third-place slot.
 * @param {string} id
 * @returns {boolean}
 */
export function isThirdPlaceSlot(id) {
  return R32_CONFIG_BY_ID[id]?.type === 'third';
}

/**
 * Get the R32 display configuration for a given matchup id.
 * @param {string} id
 * @returns {Object|undefined}
 */
export function getR32Config(id) {
  return R32_CONFIG_BY_ID[id];
}
