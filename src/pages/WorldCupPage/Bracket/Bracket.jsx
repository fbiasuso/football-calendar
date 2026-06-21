// Bracket component — Single-elimination bracket tree
// R32 → R16 → QF → SF → Final in classic bracket layout
// Uses CSS Grid with 9 columns (5 round + 4 connector columns)
import { useState, useMemo, useCallback } from 'react';
import useAppStore from '../../../store/useAppStore.js';
import { resolveBracket, isThirdPlaceSlot, getR32Config } from './bracketEngine.js';
import { TOURNAMENT_GRAPH, R32_ORDER } from './bracketGraph.js';

const ROUND_NAMES = ['Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales', 'Final'];
const ROUND_INDEX_TO_ID = ['R32', 'R16', 'QF', 'SF', 'F'];

/**
 * Derive per-round state (active | completed | locked) from user picks and slots.
 * Progressively unlocks: R32 → R16 → QF → SF → Final.
 * First incomplete round is 'active'; earlier rounds are 'completed'; later rounds 'locked'.
 * R32 requires all 32 slots assigned AND all 16 R32 picks before R16 unlocks.
 */
export function computeRoundStates(wcPicks, graph, wcSlots) {
  const rounds = ['R32', 'R16', 'QF', 'SF', 'F'];
  const roundNodes = { R32: [], R16: [], QF: [], SF: [], F: [] };
  for (const [id, node] of Object.entries(graph)) {
    roundNodes[node.round].push(id);
  }

  // Build the 32 R32 slot IDs
  const r32SlotIds = roundNodes['R32'].flatMap((id) => [`${id}-home`, `${id}-away`]);

  // Check if all 32 slots are assigned
  const all32SlotsFilled = wcSlots && r32SlotIds.every(
    (slotId) => slotId in wcSlots && wcSlots[slotId] != null
  );

  const states = {};
  let foundActive = false;

  for (const round of rounds) {
    const nodes = roundNodes[round];

    let allPicked;
    if (round === 'R32') {
      // R32 requires both: all 32 slots filled + all 16 picks made
      allPicked = all32SlotsFilled && nodes.every((id) => id in wcPicks);
    } else {
      allPicked = nodes.every((id) => id in wcPicks);
    }

    if (foundActive) {
      states[round] = 'locked';
    } else if (allPicked) {
      states[round] = 'completed';
    } else {
      states[round] = 'active';
      foundActive = true;
    }
  }

  return states;
}

/** Grid row offsets for each round (formula: 2^r - 1) */
const ROUND_OFFSETS = [0, 1, 3, 7, 15];

function rowStart(round, idx) {
  return idx * Math.pow(2, round + 1) + 3 + ROUND_OFFSETS[round];
}
function rowSpan(round) {
  return Math.pow(2, round + 1);
}

/** Parse "1°A" → { rank: 1, group: 'A' } */
function parseLabel(label) {
  const m = label.match(/^(\d+)[°]([A-L])$/);
  return m ? { rank: parseInt(m[1], 10), group: m[2] } : null;
}

/** Convert rank+group to source description */
function rankToSource(rank, group) {
  if (rank === 1) return `Ganador del grupo ${group}`;
  if (rank === 2) return `Subcampeón del grupo ${group}`;
  return `3° del grupo ${group}`;
}

/**
 * Get all teams from standings for a given group letter.
 * @param {Array} standings
 * @param {string} groupLetter
 * @returns {Array<{name, logo, rank}>}
 */
function getTeamsByGroup(standings, groupLetter) {
  if (!Array.isArray(standings)) return [];
  const group = standings.find((g) => g.group === groupLetter);
  return group?.teams || [];
}

/** Third-place candidate groups for each slot (from official FIFA 2026 rules) */
const THIRD_PLACE_CANDIDATES = {
  M74: 'A/B/C/D/F',
  M77: 'C/D/F/G/H',
  M79: 'C/E/F/H/I',
  M80: 'E/H/I/J/K',
  M81: 'B/E/F/I/J',
  M82: 'A/E/H/I/J',
  M85: 'E/F/G/I/J',
  M87: 'D/E/I/J/L',
};

/**
 * R32 display configuration (dates, labels) in visual grid order.
 * Matches R32_PAIRS flattened: M74, M77, M73, M75, M83, M84, M81, M82,
 *                              M76, M78, M79, M80, M86, M88, M85, M87
 */
const R32_DISPLAY = [
  { id: 'M74', date: 'lun, 29 jun, 17:30', homeLabel: '1°E', awayLabel: null },
  { id: 'M77', date: 'mar, 30 jun, 18:00', homeLabel: '1°I', awayLabel: null },
  { id: 'M73', date: 'dom, 28 jun, 16:00', homeLabel: '2°A', awayLabel: '2°B' },
  { id: 'M75', date: 'lun, 29 jun, 22:00', homeLabel: '1°F', awayLabel: '2°C' },
  { id: 'M83', date: 'jue, 2 jul, 20:00', homeLabel: '2°K', awayLabel: '2°L' },
  { id: 'M84', date: 'jue, 2 jul, 16:00', homeLabel: '1°H', awayLabel: '2°J' },
  { id: 'M81', date: 'mié, 1 jul, 21:00', homeLabel: '1°D', awayLabel: null },
  { id: 'M82', date: 'mié, 1 jul, 17:00', homeLabel: '1°G', awayLabel: null },
  { id: 'M76', date: 'lun, 29 jun, 14:00', homeLabel: '1°C', awayLabel: '2°F' },
  { id: 'M78', date: 'mar, 30 jun, 14:00', homeLabel: '2°E', awayLabel: '2°I' },
  { id: 'M79', date: 'mar, 30 jun, 22:00', homeLabel: '1°A', awayLabel: null },
  { id: 'M80', date: 'mié, 1 jul, 13:00', homeLabel: '1°L', awayLabel: null },
  { id: 'M86', date: 'vie, 3 jul, 19:00', homeLabel: '1°J', awayLabel: '2°H' },
  { id: 'M88', date: 'vie, 3 jul, 15:00', homeLabel: '2°D', awayLabel: '2°G' },
  { id: 'M85', date: 'vie, 3 jul, 0:00',  homeLabel: '1°B', awayLabel: null },
  { id: 'M87', date: 'vie, 3 jul, 22:30', homeLabel: '1°K', awayLabel: null },
];

const R32_DISPLAY_BY_ID = Object.fromEntries(R32_DISPLAY.map((d) => [d.id, d]));

// ── SlotPoolSelector component ──────────────────────────────────────────────
/**
 * Pool selector for R32 slot assignment. Shows 4 team cards from a single group.
 * For third-place slots, the away side cycles through candidate groups with arrows.
 *
 * Props:
 *   matchupId        - R32 matchup id (e.g. 'M73')
 *   side             - 'home' | 'away'
 *   standings        - Array<{group, teams}>
 *   slotTeam         - Currently assigned team from wcSlots (or null)
 *   onPick           - Called with (matchupId, side, team) when a team card is clicked
 *   onChangeTeam     - Called with (matchupId, side) when "Cambiar equipo" is clicked
 *   isThirdSide      - True if this side cycles through third-place candidate groups
 *   candidateGroups  - Array of group letters for cycling (null if fixed)
 *   isExpanded       - True when this side has a selected team (expanded card mode)
 */
function SlotPoolSelector({
  matchupId,
  side,
  standings,
  slotTeam,
  onPick,
  onChangeTeam,
  isThirdSide,
  candidateGroups,
  isExpanded = false,
}) {
  const cfg = getR32Config(matchupId);

  // Determine the current group
  const groupLetter =
    (!cfg)
      ? null
      : isThirdSide
        ? null // handled below with cycling state
        : (side === 'home' ? cfg.homeGroup : cfg.awayGroup);

  // For third-place cycling
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const effectiveGroup = isThirdSide
    ? candidateGroups?.[currentGroupIdx] || null
    : groupLetter;

  const teams = effectiveGroup ? getTeamsByGroup(standings, effectiveGroup) : [];

  const totalGroups = candidateGroups?.length || 1;

  const handlePrev = useCallback(() => {
    setCurrentGroupIdx((prev) => (prev > 0 ? prev - 1 : totalGroups - 1));
  }, [totalGroups]);

  const handleNext = useCallback(() => {
    setCurrentGroupIdx((prev) => (prev < totalGroups - 1 ? prev + 1 : 0));
  }, [totalGroups]);

  // Expanded view: selected team card at full size + "Cambiar equipo"
  if (isExpanded && slotTeam) {
    return (
      <div className="flex flex-col min-w-0 items-center gap-2">
        <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 border-blue-300 bg-blue-50 w-full">
          {slotTeam.logo && (
            <img src={slotTeam.logo} alt="" className="w-10 h-10 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <span className="text-sm font-semibold text-blue-800 text-center truncate w-full">
            {slotTeam.name}
          </span>
          <span className="text-blue-600 text-xs">✓</span>
        </div>
        <button
          onClick={() => onChangeTeam(matchupId, side)}
          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 underline"
        >
          Cambiar equipo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Team cards — always clickable */}
      <div className="flex flex-col gap-1.5">
        {teams.map((team) => {
          const isSelected = slotTeam?.name === team.name && slotTeam?.group === team.group;
          return (
            <button
              key={`${team.group}-${team.rank}`}
              onClick={() => onPick(matchupId, side, team)}
              className={`
                flex items-center gap-2 px-2 py-1.5 rounded-md border text-xs transition-all text-left
                ${isSelected
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                }
                cursor-pointer
              `}
            >
              {team.logo && (
                <img src={team.logo} alt="" className="w-5 h-5 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
              )}
              <span className={`truncate flex-1 ${isSelected ? 'font-semibold text-blue-800' : 'text-gray-700'}`}>
                {team.name}
              </span>
              {isSelected && (
                <span className="text-blue-600 text-xs flex-shrink-0">✓</span>
              )}
            </button>
          );
        })}
        {teams.length === 0 && (
          <div className="text-[10px] text-gray-400 italic px-2 py-3 text-center">
            Sin datos
          </div>
        )}
      </div>

      {/* Group indicator - for third-place cycling (only when NOT expanded) */}
      {isThirdSide && candidateGroups && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={handlePrev}
            className="text-gray-400 hover:text-gray-600 text-sm leading-none px-1 py-0.5"
            aria-label="Grupo anterior"
          >
            ◀
          </button>
          <span className="text-[10px] font-medium text-gray-500 uppercase">
            Grupo {effectiveGroup} <span className="text-gray-400 font-normal">({currentGroupIdx + 1}/{totalGroups})</span>
          </span>
          <button
            onClick={handleNext}
            className="text-gray-400 hover:text-gray-600 text-sm leading-none px-1 py-0.5"
            aria-label="Grupo siguiente"
          >
            ▶
          </button>
        </div>
      )}

      {/* Static group indicator for fixed */}
      {!isThirdSide && effectiveGroup && (
        <div className="mt-2 text-center">
          <span className="text-[10px] font-medium text-gray-500 uppercase">
            Grupo {effectiveGroup}
          </span>
        </div>
      )}
    </div>
  );
}

export default function Bracket({ standings: externalStandings, loading, rankerResult }) {
  const { wcStandings, wcPicks, setWcPick, clearWcPicks, bracketMode, setBracketMode, wcSlots, setWcSlot, clearWcSlot, clearAllWcSlots } = useAppStore();
  const [selectedMatchup, setSelectedMatchup] = useState(null);

  const standings = externalStandings || wcStandings?.groups || wcStandings || [];
  const hasStandings = standings.length > 0;

  // ── Locked mode filter: prevent user picks/slots from leaking into engine ────
  const effectivePicks = bracketMode === 'locked' ? {} : wcPicks;
  const effectiveSlots = bracketMode === 'locked' ? null : wcSlots;

  // ── Resolve full bracket via pure engine ────────────────────────────────────
  const bracketData = useMemo(() => {
    if (!hasStandings) return null;
    try {
      return resolveBracket(effectivePicks, TOURNAMENT_GRAPH, standings, rankerResult || null, effectiveSlots);
    } catch {
      return null;
    }
  }, [hasStandings, effectivePicks, standings, rankerResult, effectiveSlots, bracketMode]);

  // ── Derive per-round state from picks + slots ────────────────────────────────
  const roundStates = useMemo(
    () => computeRoundStates(effectivePicks, TOURNAMENT_GRAPH, effectiveSlots),
    [wcPicks, wcSlots, bracketMode],
  );

  // ── Build rounds + connectors with grid positioning ─────────────────────────
  const { rounds, connectors } = useMemo(() => {
    const roundsData = [];
    const conns = [];

    for (let r = 0; r < 5; r++) {
      const numMatchups = Math.pow(2, 4 - r);
      const matchups = [];

      for (let i = 0; i < numMatchups; i++) {
        let matchup;

        if (r === 0) {
          // R32 — use visual order from R32_ORDER
          const r32Id = R32_ORDER[i];
          const resolved = bracketData?.matchups[r32Id];
          const display = R32_DISPLAY_BY_ID[r32Id];
          const isThird = isThirdPlaceSlot(r32Id);
          const isSim = isThird && !!(resolved?.away);

          if (resolved) {
            matchup = {
              ...resolved,
              id: r32Id,
              date: display?.date,
              isThirdPlace: isThird,
              isSimulated: isSim,
              isPlaceholder: false,
            };
          } else {
            matchup = {
              id: r32Id,
              home: null,
              away: null,
              winner: null,
              isPending: false,
              isThirdPlace: isThird,
              isSimulated: false,
              isPlaceholder: true,
              date: display?.date,
              type: null,
            };
          }
        } else {
          // R16+ — lookup by DAG id
          const resolvedId =
            r === 1 ? `R16-M${i + 1}`
            : r === 2 ? `QF-M${i + 1}`
            : r === 3 ? `SF-M${i + 1}`
            :            'F-M1';
          const resolved = bracketData?.matchups[resolvedId];

          if (resolved) {
            matchup = {
              ...resolved,
              id: resolvedId,
              isThirdPlace: false,
              isSimulated: false,
              isPlaceholder: false,
            };
          } else {
            matchup = {
              id: resolvedId,
              home: null,
              away: null,
              winner: null,
              isPending: false,
              isThirdPlace: false,
              isSimulated: false,
              isPlaceholder: true,
              type: null,
            };
          }
        }

        const gridCol = r * 2 + 1;
        matchups.push({
          ...matchup,
          roundIndex: r,
          matchupIndex: i,
          gridRow: `${rowStart(r, i)} / span ${rowSpan(r)}`,
          gridCol,
        });
      }

      roundsData.push({ name: ROUND_NAMES[r], matchups, numMatchups });

      // Connectors for this round (except final)
      if (r < 4) {
        const numPairs = numMatchups / 2;
        for (let p = 0; p < numPairs; p++) {
          const firstIdx = p * 2;
          const halfSpan = rowSpan(r) / 2;
          const connLift = Math.pow(2, r) - 1;
          const connStart = rowStart(r, firstIdx) + halfSpan - connLift;
          const connSpan = rowSpan(r);

          conns.push({
            roundIndex: r,
            pairIndex: p,
            key: `c-r${r}-p${p}`,
            gridRow: `${connStart} / span ${connSpan}`,
            gridCol: r * 2 + 2,
          });
        }
      }
    }

    return { rounds: roundsData, connectors: conns };
  }, [bracketData]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handlePick = (id, side) => {
    setWcPick(id, side);
    setSelectedMatchup(null);
  };

  // Slot handler for R32 modal step 'teams': assign team to slot, don't pick winner
  const handleSlotAssign = useCallback((matchupId, side, team) => {
    const slotId = `${matchupId}-${side}`;
    const currentSlot = wcSlots[slotId];
    const isSameTeam = currentSlot?.name === team.name && currentSlot?.group === team.group;
    if (isSameTeam) {
      clearWcSlot(slotId);
    } else {
      setWcSlot(slotId, team);
    }
  }, [setWcSlot, clearWcSlot, wcSlots]);

  // Winner pick handler for R32 modal step 'winner': saves pick and closes modal
  const handleWinnerPick = useCallback((matchupId, side) => {
    setWcPick(matchupId, side);
    setSelectedMatchup(null);
  }, [setWcPick, setSelectedMatchup]);

  // ── Render a single matchup cell ────────────────────────────────────────────
  const renderCell = (m) => {
    const roundId = ROUND_INDEX_TO_ID[m.roundIndex];
    const roundState = roundStates[roundId];

    const isEditable =
      bracketMode === 'editing' && roundState === 'active';

    // For R32 cells in editing mode, use wcSlots directly for display
    let displayHome = m.home;
    let displayAway = m.away;
    if (m.roundIndex === 0 && bracketMode === 'editing') {
      displayHome = wcSlots?.[`${m.id}-home`] || null;
      displayAway = wcSlots?.[`${m.id}-away`] || null;
    }

    const isClickable =
      !m.isPlaceholder &&
      !!m.home &&
      !!m.away;

    // R32 cells are always clickable in editing mode (to open slot assign modal)
    // All cells are clickable in locked mode (to open read-only modal)
    const cellClickable =
      bracketMode === 'locked'
        ? isClickable || (m.roundIndex === 0 && !m.isPlaceholder)
        : (bracketMode === 'editing' && isEditable && (
            m.roundIndex === 0 ? !m.isPlaceholder : isClickable
          ));

    const isPickedHome = m.winner === 'home';
    const isPickedAway = m.winner === 'away';

    const isLockedRound = bracketMode === 'editing' && roundState === 'locked';
    const isLockedMode = bracketMode === 'locked';

    // Text for R32 teams in editing mode
    const homeName = m.roundIndex === 0 && bracketMode === 'editing'
      ? (displayHome?.name || 'Elegir Equipo')
      : (displayHome?.name || (m.isPlaceholder ? '—' : (m.roundIndex > 0 && m.away && !m.home ? 'Pendiente' : (m.isThirdPlace && !m.home ? '3° ?' : 'TBD'))));

    const awayName = m.roundIndex === 0 && bracketMode === 'editing'
      ? (displayAway?.name || 'Elegir Equipo')
      : (displayAway?.name || (m.isPlaceholder ? '—' : (m.roundIndex > 0 && m.home && !m.away ? 'Pendiente' : (m.isThirdPlace && !m.away ? '3° ?' : 'TBD'))));

    return (
      <div
        key={`cell-${m.roundIndex}-${m.matchupIndex}`}
        className={`
          matchup-cell flex flex-col justify-center relative
          ${m.isThirdPlace ? 'border-orange-200' : 'border-gray-200'}
          ${cellClickable && m.roundIndex === 0 ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm' : ''}
          ${cellClickable && m.roundIndex > 0 ? 'cursor-pointer hover:border-gray-300' : ''}
          ${!isClickable && !m.isPlaceholder ? 'opacity-50' : ''}
          ${isLockedRound ? 'opacity-40 pointer-events-none' : ''}
          bg-white border rounded-md px-1.5 py-1 transition-all text-xs
        `}
        style={{
          gridRow: m.gridRow,
          gridColumn: m.gridCol,
          height: '52px',
        }}
        onClick={() => {
          if (cellClickable) setSelectedMatchup(m);
        }}
        role={cellClickable ? 'button' : undefined}
        tabIndex={cellClickable ? 0 : -1}
        onKeyDown={(e) => {
          if (cellClickable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setSelectedMatchup(m);
          }
        }}
      >
        {/* Horizontal line going RIGHT */}
        <div className="absolute left-full top-1/2 w-2 h-px bg-gray-500 -translate-y-1/2 pointer-events-none" />

        {/* Home team */}
        <div className="flex items-center gap-1.5">
          {displayHome?.logo && (
            <img src={displayHome.logo} alt="" className="w-4 h-4 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <span className={`truncate ${displayHome?.name ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
            {homeName}
          </span>
          {isPickedHome && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="Pickeado" />
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {displayAway?.logo && (
            <img src={displayAway.logo} alt="" className="w-4 h-4 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          <span className={`truncate ${displayAway?.name ? 'font-medium text-gray-800' : 'text-gray-400'}`}>
            {awayName}
          </span>
          {isPickedAway && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title="Pickeado" />
          )}
          {m.isSimulated && (
            <span className="text-[9px] text-orange-600 bg-orange-100 px-1 rounded font-bold ml-auto flex-shrink-0">SIM</span>
          )}
        </div>
      </div>
    );
  };

  // ── Render a connector element ──────────────────────────────────────────────
  const renderConnector = (conn) => (
    <div
      key={conn.key}
      className="bracket-connector relative"
      style={{
        gridRow: conn.gridRow,
        gridColumn: conn.gridCol,
      }}
    >
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-500 -translate-x-1/2 pointer-events-none" />
      <div className="absolute left-1/2 top-1/2 right-0 h-px bg-gray-500 -translate-y-1/2 pointer-events-none" />
    </div>
  );

  // ── R16+ Winner Pick Modal ─────────────────────────────────────────────────
  const renderR16PlusModal = () => {
    const m = selectedMatchup;
    const display = R32_DISPLAY_BY_ID[m.id];
    const canPick = bracketMode === 'editing' && roundStates[ROUND_INDEX_TO_ID[m.roundIndex]] === 'active' && !!(m.home && m.away);

    // Build source descriptions (only for R32 with display config)
    let homeSource = null;
    let awaySource = null;
    if (m.roundIndex === 0 && display) {
      if (display.homeLabel) {
        const p = parseLabel(display.homeLabel);
        if (p) homeSource = rankToSource(p.rank, p.group);
      }
      if (display.awayLabel) {
        const p = parseLabel(display.awayLabel);
        if (p) awaySource = rankToSource(p.rank, p.group);
      } else if (m.isThirdPlace) {
        awaySource = `3° del grupo ${THIRD_PLACE_CANDIDATES[m.id] || ''}`;
      }
    }

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMatchup(null)}>
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.id}</h3>
              {display?.date && <p className="text-xs text-gray-500 mt-0.5">{display.date}</p>}
            </div>
            <button onClick={() => setSelectedMatchup(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1" aria-label="Cerrar">✕</button>
          </div>

          {/* Team cards - click to pick winner */}
          <div className="flex items-center justify-between gap-3">
            {/* Home team card */}
            <div
              className={`
                flex flex-col items-center gap-2 text-center flex-1 min-w-0 p-3 rounded-lg border-2 transition-all
                ${!canPick
                  ? 'border-gray-100 bg-gray-50'
                  : wcPicks[m.id] === 'home'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
                }
              `}
              onClick={() => {
                if (canPick) handlePick(m.id, 'home');
              }}
            >
              {m.home?.logo && <img src={m.home.logo} alt="" className="w-12 h-12" onError={(e) => { e.target.style.display = 'none'; }} />}
              <span className="text-sm font-semibold text-gray-900 truncate w-full">{m.home?.name || (m.roundIndex === 0 ? 'TBD' : 'Pendiente')}</span>
              {homeSource && <span className="text-[10px] text-gray-400 leading-tight">{homeSource}</span>}
              {wcPicks[m.id] === 'home' && (
                <span className="text-blue-600 text-lg leading-none">✓</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-gray-400 uppercase">vs</span>
            </div>

            {/* Away team card */}
            <div
              className={`
                flex flex-col items-center gap-2 text-center flex-1 min-w-0 p-3 rounded-lg border-2 transition-all
                ${!canPick
                  ? 'border-gray-100 bg-gray-50'
                  : wcPicks[m.id] === 'away'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50 cursor-pointer'
                }
              `}
              onClick={() => {
                if (canPick) handlePick(m.id, 'away');
              }}
            >
              {m.away?.logo && <img src={m.away.logo} alt="" className="w-12 h-12" onError={(e) => { e.target.style.display = 'none'; }} />}
              <span className="text-sm font-semibold text-gray-900 truncate w-full">{m.away?.name || (m.roundIndex === 0 && m.isThirdPlace ? '3° por definir' : m.roundIndex === 0 ? 'TBD' : 'Pendiente')}</span>
              {awaySource && <span className="text-[10px] text-gray-400 leading-tight">{awaySource}</span>}
              {wcPicks[m.id] === 'away' && (
                <span className="text-blue-600 text-lg leading-none">✓</span>
              )}
            </div>
          </div>

          {/* Footer info */}
          <div className="mt-4 text-center">
            {bracketMode === 'editing' && roundStates[ROUND_INDEX_TO_ID[m.roundIndex]] === 'locked' ? (
              <span className="text-[11px] text-amber-600 font-medium">
                Completá los picks de la ronda anterior para desbloquear
              </span>
            ) : bracketMode === 'editing' && roundStates[ROUND_INDEX_TO_ID[m.roundIndex]] === 'completed' ? (
              <span className="text-[11px] text-green-600 font-medium">
                Ya seleccionaste un ganador para este cruce
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">
                {m.isPlaceholder
                  ? 'Las posiciones estarán disponibles cuando comience el torneo.'
                  : !(m.home && m.away)
                    ? 'Ambos equipos deben estar definidos para seleccionar un ganador.'
                    : bracketMode === 'editing' && roundStates[ROUND_INDEX_TO_ID[m.roundIndex]] === 'active'
                      ? 'Elegí el ganador de este cruce'
                      : 'Partido determinado por resultados de rondas anteriores.'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Locked Mode Modal (read-only) ─────────────────────────────────────────
  const renderLockedModal = () => {
    const m = selectedMatchup;
    const display = R32_DISPLAY_BY_ID[m.id];

    // Build source descriptions
    let homeSource = null;
    let awaySource = null;
    if (m.roundIndex === 0 && display) {
      if (display.homeLabel) {
        const p = parseLabel(display.homeLabel);
        if (p) homeSource = rankToSource(p.rank, p.group);
      }
      if (display.awayLabel) {
        const p = parseLabel(display.awayLabel);
        if (p) awaySource = rankToSource(p.rank, p.group);
      } else if (m.isThirdPlace) {
        awaySource = `3° del grupo ${THIRD_PLACE_CANDIDATES[m.id] || ''}`;
      }
    }

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMatchup(null)}>
        <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.id}</h3>
              {display?.date && <p className="text-xs text-gray-500 mt-0.5">{display.date}</p>}
            </div>
            <button onClick={() => setSelectedMatchup(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1" aria-label="Cerrar">✕</button>
          </div>

          {/* Teams - read only */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center gap-2 text-center flex-1 min-w-0 p-3 rounded-lg border-2 border-gray-100 bg-gray-50">
              {m.home?.logo && <img src={m.home.logo} alt="" className="w-12 h-12" onError={(e) => { e.target.style.display = 'none'; }} />}
              <span className="text-sm font-semibold text-gray-900 truncate w-full">{m.home?.name || '—'}</span>
              {homeSource && <span className="text-[10px] text-gray-400 leading-tight">{homeSource}</span>}
              {m.winner === 'home' && (
                <span className="text-blue-600 text-lg leading-none">✓</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-gray-400 uppercase">vs</span>
              {m.isSimulated && (
                <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">SIMULACIÓN</span>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 text-center flex-1 min-w-0 p-3 rounded-lg border-2 border-gray-100 bg-gray-50">
              {m.away?.logo && <img src={m.away.logo} alt="" className="w-12 h-12" onError={(e) => { e.target.style.display = 'none'; }} />}
              <span className="text-sm font-semibold text-gray-900 truncate w-full">{m.away?.name || '—'}</span>
              {awaySource && <span className="text-[10px] text-gray-400 leading-tight">{awaySource}</span>}
              {m.winner === 'away' && (
                <span className="text-blue-600 text-lg leading-none">✓</span>
              )}
            </div>
          </div>

          {/* Footer info */}
          <div className="mt-4 text-center">
            <span className="text-[11px] text-gray-400">
              {m.isPlaceholder
                ? 'Las posiciones estarán disponibles cuando comience el torneo.'
                : !(m.home && m.away)
                  ? 'Equipos por definir.'
                  : m.winner
                    ? `Ganador: ${m.winner === 'home' ? m.home?.name : m.away?.name}`
                    : 'Partido determinado por resultados de rondas anteriores.'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // ── Modal dispatcher ────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!selectedMatchup) return null;
    const m = selectedMatchup;
    const roundState = roundStates[ROUND_INDEX_TO_ID[m.roundIndex]];

    // Locked mode: always show locked modal
    if (bracketMode === 'locked') {
      return renderLockedModal();
    }

    // R32 editing mode: show slot assignment modal
    if (m.roundIndex === 0) {
      return <R32ModalWrapper matchup={m} />;
    }

    // R16+ editing mode: show winner pick modal
    return renderR16PlusModal();
  };

  // ── R32Modal: 2-step flow ('teams' → 'winner') ──────────────────────────────
  // R32ModalWrapper: re-creates on each selectedMatchup change via key
  const R32ModalWrapper = ({ matchup }) => <R32Modal key={matchup.id} matchup={matchup} />;
  const R32Modal = ({ matchup }) => {
    const m = matchup;
    const display = R32_DISPLAY_BY_ID[m.id];
    const cfg = getR32Config(m.id);
    const isThird = m.isThirdPlace;

    const awayCandidates = isThird
      ? (THIRD_PLACE_CANDIDATES[m.id]?.split('/') || [])
      : (cfg ? [cfg.awayGroup] : []);

    const homeSlotTeam = wcSlots?.[`${m.id}-home`] || null;
    const awaySlotTeam = wcSlots?.[`${m.id}-away`] || null;
    const hasHome = !!homeSlotTeam;
    const hasAway = !!awaySlotTeam;
    const showWinnerStep = hasHome && hasAway;

    // "Cambiar equipo" handler: clear slot + clear winner pick + downstream
    const handleChangeTeam = (mid, side) => {
      clearWcSlot(`${mid}-${side}`);
      setWcPick(mid, undefined);
    };

    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMatchup(null)}>
        <div className="bg-white rounded-xl shadow-xl p-5 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.id}</h3>
              {display?.date && <p className="text-xs text-gray-500 mt-0.5">{display.date}</p>}
            </div>
            <button onClick={() => setSelectedMatchup(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1" aria-label="Cerrar">✕</button>
          </div>

          {/* Step: Teams assignment */}
          {!showWinnerStep && (
            <>
              <div className="flex gap-4">
                <SlotPoolSelector
                  matchupId={m.id}
                  side="home"
                  standings={standings}
                  slotTeam={homeSlotTeam}
                  onPick={handleSlotAssign}
                  onChangeTeam={handleChangeTeam}
                  isThirdSide={false}
                  candidateGroups={null}
                  isExpanded={hasHome}
                />

                {/* VS divider */}
                <div className="flex flex-col items-center justify-center flex-shrink-0 w-8">
                  <span className="text-xs font-bold text-gray-400 uppercase">vs</span>
                  {m.isSimulated && (
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded mt-1">SIM</span>
                  )}
                </div>

                <SlotPoolSelector
                  matchupId={m.id}
                  side="away"
                  standings={standings}
                  slotTeam={awaySlotTeam}
                  onPick={handleSlotAssign}
                  onChangeTeam={handleChangeTeam}
                  isThirdSide={isThird}
                  candidateGroups={isThird ? awayCandidates : null}
                  isExpanded={hasAway}
                />
              </div>

              {/* Footer: teams step */}
              <div className="mt-4 text-center">
                <span className="text-[11px] text-gray-500">
                  Elegí los equipos del cruce
                </span>
              </div>
            </>
          )}

          {/* Step: Winner pick */}
          {showWinnerStep && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xs font-medium text-gray-500">Elegí el ganador del cruce</p>
              <div className="flex items-center justify-between gap-3 w-full">
                {/* Home team */}
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <div
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all w-full"
                    onClick={() => handleWinnerPick(m.id, 'home')}
                  >
                    {homeSlotTeam?.logo && (
                      <img src={homeSlotTeam.logo} alt="" className="w-10 h-10" onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                    <span className="text-sm font-semibold text-gray-900 truncate w-full text-center">
                      {homeSlotTeam?.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleChangeTeam(m.id, 'home')}
                    className="text-[10px] font-medium text-blue-600 hover:text-blue-800 underline"
                  >
                    Cambiar equipo
                  </button>
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-bold text-gray-400 uppercase">vs</span>
                  {m.isSimulated && (
                    <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded mt-1">SIM</span>
                  )}
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                  <div
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all w-full"
                    onClick={() => handleWinnerPick(m.id, 'away')}
                  >
                    {awaySlotTeam?.logo && (
                      <img src={awaySlotTeam.logo} alt="" className="w-10 h-10" onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                    <span className="text-sm font-semibold text-gray-900 truncate w-full text-center">
                      {awaySlotTeam?.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleChangeTeam(m.id, 'away')}
                    className="text-[10px] font-medium text-blue-600 hover:text-blue-800 underline"
                  >
                    Cambiar equipo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Loading / Empty states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm text-gray-500">Cargando posiciones…</p>
      </div>
    );
  }

  if (!hasStandings) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center max-w-md">
          <p className="text-gray-500 font-medium mb-2">Sin datos de posiciones</p>
          <p className="text-gray-400 text-sm">Las posiciones estarán disponibles cuando comience el torneo.</p>
        </div>
      </div>
    );
  }

  // ── Champion name ────────────────────────────────────────────────────────────
  const championName = useMemo(() => {
    if (!wcPicks['F-M1'] || !bracketData?.matchups['F-M1']) return null;
    const final = bracketData.matchups['F-M1'];
    if (final.winner === 'home' && final.home?.name) return final.home.name;
    if (final.winner === 'away' && final.away?.name) return final.away.name;
    return null;
  }, [wcPicks, bracketData]);

  // ── Main render ─────────────────────────────────────────────────────────────
  const pickCount = Object.keys(wcPicks).length;
  const slotCount = Object.keys(wcSlots).length;

  return (
    <div>
      {renderModal()}

      {/* Champion banner */}
      {championName && (
        <div className="mb-4 flex items-center justify-center gap-2 bg-yellow-50 border-2 border-yellow-400 rounded-xl px-6 py-3">
          <span className="text-lg">🏆</span>
          <p className="text-base font-bold text-yellow-800">
            CAMPEÓN: {championName}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setBracketMode(bracketMode === 'locked' ? 'editing' : 'locked')}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            bracketMode === 'editing'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {bracketMode === 'editing' ? '🔒 Bloquear' : '✏️ Editar predicciones'}
        </button>
        <button
          onClick={() => { clearWcPicks(); clearAllWcSlots(); setSelectedMatchup(null); }}
          disabled={pickCount === 0 && slotCount === 0}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
            pickCount === 0 && slotCount === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          Resetear picks
        </button>
        {pickCount === 0 && bracketMode === 'locked' && (
          <span className="text-xs text-gray-500">Cambiá a Editar predicciones para elegir ganadores</span>
        )}
        {pickCount === 0 && bracketMode === 'editing' && (
          <span className="text-xs text-gray-500">Hacé click en cualquier cruce de R32 para asignar equipos y elegir ganador</span>
        )}
        {pickCount > 0 && (
          <span className="text-xs text-gray-400">
            {pickCount} pick{pickCount !== 1 ? 's' : ''} + {slotCount} slot{slotCount !== 1 ? 's' : ''} — los resultados se propagan automáticamente
          </span>
        )}
      </div>

      {/* Bracket grid — 9 columns: R32 | C | R16 | C | QF | C | SF | C | F */}
      <div className="overflow-x-auto pb-4">
        <div
          className="grid min-w-[700px]"
          style={{
            gridTemplateColumns: 'minmax(120px, 1fr) 16px minmax(120px, 1fr) 16px minmax(120px, 1fr) 16px minmax(120px, 1fr) 16px minmax(120px, 1fr)',
            gridTemplateRows: '32px 28px repeat(47, 28px)',
          }}
        >
          {/* Round headers */}
          {ROUND_NAMES.map((name, r) => {
            const roundId = ROUND_INDEX_TO_ID[r];
            const state = roundStates[roundId];
            const headerClasses =
              state === 'active'
                ? 'text-blue-700 border-b-2 border-blue-400 bg-blue-50'
                : state === 'completed'
                  ? 'text-green-700 border-b-2 border-green-400 bg-green-50'
                  : 'text-gray-400 border-b border-gray-200';
            const stateIcon =
              state === 'completed' ? ' ✓' : state === 'locked' ? ' 🔒' : '';

            return (
              <div
                key={`hdr-${r}`}
                className={`text-center text-xs font-bold uppercase tracking-wider pb-2 transition-colors ${headerClasses}`}
                style={{ gridRow: '1', gridColumn: r * 2 + 1 }}
                data-round-state={state}
              >
                {name}{stateIcon}
              </div>
            );
          })}

          {/* Matchup cells */}
          {rounds.map((round) =>
            round.matchups.map((m) => renderCell(m))
          )}

          {/* Connector elements */}
          {connectors.map((conn) => renderConnector(conn))}
        </div>
      </div>
    </div>
  );
}
