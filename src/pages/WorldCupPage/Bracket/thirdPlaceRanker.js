// thirdPlaceRanker - Pure function for World Cup 2026 third-place simulation
//
// FIFA 2026 World Cup: 12 groups (A-L), top 2 from each group advance (24 teams)
// plus top 8 third-placed teams. This function ranks third-placed teams and
// assigns them to R32 slots using the official FIFA Annex C lookup table.

import { findAnnexC } from './annexCData.js';

/**
 * Fixed R32 matchups (no third-place assignment needed)
 */
const FIXED_MATCHUPS = [
  { matchupId: 'M73', homeLabel: '2°A', awayLabel: '2°B' },
  { matchupId: 'M75', homeLabel: '1°F', awayLabel: '2°C' },
  { matchupId: 'M76', homeLabel: '1°C', awayLabel: '2°F' },
  { matchupId: 'M78', homeLabel: '2°E', awayLabel: '2°I' },
  { matchupId: 'M83', homeLabel: '2°K', awayLabel: '2°L' },
  { matchupId: 'M84', homeLabel: '1°H', awayLabel: '2°J' },
  { matchupId: 'M86', homeLabel: '1°J', awayLabel: '2°H' },
  { matchupId: 'M88', homeLabel: '2°D', awayLabel: '2°G' },
];

/**
 * R32 matchups requiring third-place assignment.
 * Each entry: opponent group (who the third-place team faces) + candidate groups
 * that can supply the third-place team.
 */
const THIRD_PLACE_SLOTS = [
  { matchupId: 'M74', opponentGroup: '1°E', candidateGroups: ['A', 'B', 'C', 'D', 'F'] },
  { matchupId: 'M77', opponentGroup: '1°I', candidateGroups: ['C', 'D', 'F', 'G', 'H'] },
  { matchupId: 'M79', opponentGroup: '1°A', candidateGroups: ['C', 'E', 'F', 'H', 'I'] },
  { matchupId: 'M80', opponentGroup: '1°L', candidateGroups: ['E', 'H', 'I', 'J', 'K'] },
  { matchupId: 'M81', opponentGroup: '1°D', candidateGroups: ['B', 'E', 'F', 'I', 'J'] },
  { matchupId: 'M82', opponentGroup: '1°G', candidateGroups: ['A', 'E', 'H', 'I', 'J'] },
  { matchupId: 'M85', opponentGroup: '1°B', candidateGroups: ['E', 'F', 'G', 'I', 'J'] },
  { matchupId: 'M87', opponentGroup: '1°K', candidateGroups: ['D', 'E', 'I', 'J', 'L'] },
];

/**
 * Sort comparator for third-placed teams: points DESC > goalDiff DESC > goalsFor DESC
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function sortThirdPlace(a, b) {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  return (b.goalsFor || 0) - (a.goalsFor || 0);
}

/**
 * Pure function: extract third-placed teams from standings, rank them,
 * select top 8, and assign to R32 slots using FIFA Annex C lookup.
 *
 * @param {Array<{group: string, teams: Array}>} standings
 *   Array of group objects. Each team entry must have:
 *   { rank, name, logo, points, goalDiff, goalsFor, played, wins, draws, losses, goalsAgainst }
 * @returns {{
 *   fixedMatchups: Array<{matchupId, homeLabel, awayLabel}>,
 *   thirdPlaceSlots: Array<{
 *     matchupId, opponentGroup, candidateGroups,
 *     team: Object|null, isSimulated: boolean, slotIndex: number
 *   }>,
 *   rankings: Array<Object>  // all 12 ranked third-place teams for reference
 * }}
 */
export default function thirdPlaceRanker(standings) {
  // Step 1: Extract 3rd-place team from each group
  const thirdPlacedTeams = standings
    .map((group) => {
      const third = (group.teams || []).find((t) => t.rank === 3);
      return third
        ? { ...third, group: group.group }
        : null;
    })
    .filter(Boolean);

  // Step 2: Rank by points > GD > GF
  const ranked = [...thirdPlacedTeams].sort(sortThirdPlace);

  // Step 3: Take top 8
  const advancing = ranked.slice(0, 8);

  // Step 4: Use FIFA Annex C lookup for assignment
  // Annex C maps each group winner (1A, 1B, etc.) to the third-place group
  // that should face them in R32 — for all 495 C(12,8) combinations.
  const advancingGroups = advancing.map((t) => t.group);
  const annexCAssignment = findAnnexC(advancingGroups);

  // Annex C label → matchupId
  const LABEL_TO_MATCHUP = {
    '1A': 'M79', '1B': 'M85', '1D': 'M81', '1E': 'M74',
    '1G': 'M82', '1I': 'M77', '1K': 'M87', '1L': 'M80',
  };

  // Build assignment: matchupId → team object
  const assignment = {};
  if (annexCAssignment) {
    for (const [label, groupLetter] of Object.entries(annexCAssignment)) {
      const matchupId = LABEL_TO_MATCHUP[label];
      const team = advancing.find((t) => t.group === groupLetter);
      if (matchupId && team) {
        assignment[matchupId] = team;
      }
    }
  }

  // Step 5: Build slot results from Annex C assignment
  const slots = THIRD_PLACE_SLOTS.map((slot, index) => {
    const assignedTeam = assignment[slot.matchupId] || null;

    return {
      slotIndex: index,
      matchupId: slot.matchupId,
      opponentGroup: slot.opponentGroup,
      candidateGroups: slot.candidateGroups,
      team: assignedTeam,
      isSimulated: assignedTeam !== null,
    };
  });

  return {
    fixedMatchups: FIXED_MATCHUPS,
    thirdPlaceSlots: slots,
    rankings: ranked,
  };
}
