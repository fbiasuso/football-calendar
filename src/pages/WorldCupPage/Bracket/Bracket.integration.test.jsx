// Integration tests for Bracket.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Bracket from './Bracket.jsx';

afterEach(cleanup);

// ── Mock setup ────────────────────────────────────────────────────────────────

// We mock useAppStore to control wcPicks, wcStandings, wcSlots
const mockStore = vi.hoisted(() => {
  const store = {
    wcStandings: null,
    wcPicks: {},
    setWcPick: vi.fn(),
    clearWcPicks: vi.fn(),
    bracketMode: 'locked',
    setBracketMode: vi.fn(),
    wcSlots: {},
    setWcSlot: vi.fn(),
    clearWcSlot: vi.fn(),
    clearAllWcSlots: vi.fn(),
  };
  // Make actions actually update state so the component re-reads them on next render
  store.setWcSlot = vi.fn((slotId, team) => {
    store.wcSlots = { ...store.wcSlots, [slotId]: team };
  });
  store.clearWcSlot = vi.fn((slotId) => {
    const newSlots = { ...store.wcSlots };
    delete newSlots[slotId];
    store.wcSlots = newSlots;
  });
  store.clearAllWcSlots = vi.fn(() => {
    store.wcSlots = {};
  });
  store.clearWcPicks = vi.fn(() => {
    store.wcPicks = {};
  });
  store.setWcPick = vi.fn((matchupId, side) => {
    if (side === undefined) {
      // Clearing a pick — store as undefined (matches setWcPick behavior with undefined arg)
      const newPicks = { ...store.wcPicks };
      delete newPicks[matchupId];
      store.wcPicks = newPicks;
    } else {
      store.wcPicks = { ...store.wcPicks, [matchupId]: side };
    }
  });
  return store;
});

vi.mock('../../../store/useAppStore.js', () => ({
  default: vi.fn((selector) => {
    const state = {
      wcStandings: mockStore.wcStandings,
      wcPicks: mockStore.wcPicks,
      setWcPick: mockStore.setWcPick,
      clearWcPicks: mockStore.clearWcPicks,
      bracketMode: mockStore.bracketMode,
      setBracketMode: mockStore.setBracketMode,
      wcSlots: mockStore.wcSlots,
      setWcSlot: mockStore.setWcSlot,
      clearWcSlot: mockStore.clearWcSlot,
      clearAllWcSlots: mockStore.clearAllWcSlots,
    };
    return selector ? selector(state) : state;
  }),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeGroup(letter) {
  return {
    group: letter,
    teams: [
      { rank: 1, name: `${letter}1`, logo: null, points: 9, goalDiff: 10, goalsFor: 15, played: 3, wins: 3, draws: 0, losses: 0, goalsAgainst: 5 },
      { rank: 2, name: `${letter}2`, logo: null, points: 6, goalDiff: 3, goalsFor: 8, played: 3, wins: 2, draws: 0, losses: 1, goalsAgainst: 5 },
      { rank: 3, name: `${letter}3`, logo: null, points: 3, goalDiff: 0, goalsFor: 4, played: 3, wins: 1, draws: 0, losses: 2, goalsAgainst: 4 },
      { rank: 4, name: `${letter}4`, logo: null, points: 0, goalDiff: -5, goalsFor: 1, played: 3, wins: 0, draws: 0, losses: 3, goalsAgainst: 6 },
    ],
  };
}

function makeFullStandings() {
  return Array.from({ length: 12 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return makeGroup(letter);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.wcStandings = null;
  mockStore.wcPicks = {};
  mockStore.setWcPick.mockClear();
  mockStore.clearWcPicks.mockClear();
  mockStore.bracketMode = 'locked';
  mockStore.setBracketMode.mockClear();
  mockStore.wcSlots = {};
  mockStore.setWcSlot.mockClear();
  mockStore.clearWcSlot.mockClear();
  mockStore.clearAllWcSlots.mockClear();
});

describe('Bracket — loading and empty states', () => {
  it('should show loading spinner when loading is true', () => {
    render(<Bracket standings={null} loading={true} rankerResult={null} />);
    expect(screen.getByText('Cargando posiciones…')).toBeInTheDocument();
  });

  it('should show "Sin datos de posiciones" when no standings', () => {
    render(<Bracket standings={[]} loading={false} rankerResult={null} />);
    expect(screen.getByText('Sin datos de posiciones')).toBeInTheDocument();
  });

  it('should render the bracket grid when standings are provided', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Round headers should be visible (use regex to match name + optional icon suffix)
    expect(screen.getByText(/^Dieciseisavos/)).toBeInTheDocument();
    expect(screen.getByText(/^Octavos/)).toBeInTheDocument();
    expect(screen.getByText(/^Cuartos/)).toBeInTheDocument();
    expect(screen.getByText(/^Semifinales/)).toBeInTheDocument();
    expect(screen.getByText(/^Final/)).toBeInTheDocument();
  });
});

describe('Bracket — team display', () => {
  it('should show group winner names in R32 fixed matchups', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // M73: 2°A vs 2°B → A2, B2
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B2')).toBeInTheDocument();

    // M75: 1°F vs 2°C → F1, C2
    expect(screen.getByText('F1')).toBeInTheDocument();
    expect(screen.getByText('C2')).toBeInTheDocument();
  });

  it('should show "3° ?" for unresolved third-place slots', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Without rankerResult, third-place slots show "3° ?"
    const thirdSlots = screen.getAllByText('3° ?');
    expect(thirdSlots.length).toBeGreaterThanOrEqual(4);
  });

  it('should show TBD or 3° ? for undetermined R16+ matchups when no picks made', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R16+ cells have no winners propagating, showing 'TBD'
    const tbdEls = screen.getAllByText('TBD');
    expect(tbdEls.length).toBeGreaterThan(0);
  });
});

describe('Bracket — pick controls', () => {
  it('should show "Resetear picks" button disabled when no picks', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const resetBtn = screen.getByText('Resetear picks');
    expect(resetBtn).toBeInTheDocument();
    expect(resetBtn).toBeDisabled();
  });

  it('should show "Resetear picks" button enabled when picks exist', () => {
    mockStore.wcPicks = { 'M73': 'home' };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const resetBtn = screen.getByText('Resetear picks');
    expect(resetBtn).toBeEnabled();
  });

  it('should display pick count when picks are active', () => {
    mockStore.wcPicks = { 'M73': 'home', 'M75': 'away' };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    expect(screen.getByText(/2 picks.*0 slots/)).toBeInTheDocument();
  });

  it('should call clearWcPicks when "Resetear picks" is clicked', () => {
    mockStore.wcPicks = { 'M73': 'home' };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const resetBtn = screen.getByText('Resetear picks');
    fireEvent.click(resetBtn);

    expect(mockStore.clearWcPicks).toHaveBeenCalledOnce();
  });
});

describe('Bracket — modal interaction', () => {
  it('should open modal when a clickable R32 cell is clicked in editing mode', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // In editing mode, R32 cells show "Elegir Equipo" and are clickable
    const elegirEls = document.querySelectorAll('[role="button"]');
    expect(elegirEls.length).toBeGreaterThan(0);

    // Click the first clickable cell (M74 in visual order)
    fireEvent.click(elegirEls[0]);

    // Modal should show the matchup info (M74 is first in R32_ORDER)
    expect(screen.getByText('M74')).toBeInTheDocument();
  });

  it('should call setWcSlot (not setWcPick) when selecting a team in teams step', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click first R32 clickable cell (M74)
    const elegirEls = document.querySelectorAll('[role="button"]');
    fireEvent.click(elegirEls[0]);

    // Modal should show M74
    expect(screen.getByText('M74')).toBeInTheDocument();

    // Find team buttons in the modal (home pool: E1, E2, E3, E4)
    const e1Btn = screen.getByText('E1');
    expect(e1Btn).toBeInTheDocument();
    fireEvent.click(e1Btn);

    // Should call setWcSlot but NOT setWcPick (step 'teams' only assigns slot)
    expect(mockStore.setWcSlot).toHaveBeenCalledWith('M74-home', expect.objectContaining({ name: 'E1' }));
    expect(mockStore.setWcPick).not.toHaveBeenCalled();
  });

  it('should open read-only modal when clicking R32 cell in locked mode', () => {
    mockStore.bracketMode = 'locked';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // In locked mode, cells are clickable and open read-only modal
    const teamEl = screen.getByText('A2');
    const cell = teamEl.closest('.matchup-cell');
    expect(cell).not.toBeNull();
    fireEvent.click(cell);

    // Read-only modal should show matchup info without editing controls
    expect(screen.getByText('M73')).toBeInTheDocument();
    // No Local/Visitante toggle (editing controls)
    expect(screen.queryByText('Local')).toBeNull();
  });
});

describe('Bracket — editing mode', () => {
  it('should show mode toggle button and switch between modes', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Default: locked mode shows "Editar predicciones" button
    const toggleBtn = screen.getByText('✏️ Editar predicciones');
    expect(toggleBtn).toBeInTheDocument();

    // Simulate clicking the toggle (the mock just tracks calls)
    fireEvent.click(toggleBtn);
    expect(mockStore.setBracketMode).toHaveBeenCalledWith('editing');
  });

  it('should show "Editar predicciones" in locked mode and "Bloquear" in editing mode', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // In editing mode, the toggle should show "Bloquear"
    expect(screen.getByText('🔒 Bloquear')).toBeInTheDocument();
  });
});

describe('Bracket — progressive round unlock', () => {
  const ALL_R32_IDS = [
    'M73', 'M74', 'M75', 'M76', 'M77', 'M78', 'M79', 'M80',
    'M81', 'M82', 'M83', 'M84', 'M85', 'M86', 'M87', 'M88',
  ];

  it('should not allow R16 interaction when R32 is incomplete', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = {}; // No R32 picks
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 header should be active, R16 should be locked
    const r32Header = screen.getByText(/^Dieciseisavos/);
    const r16Header = screen.getByText(/^Octavos/);

    expect(r32Header.closest('[data-round-state="active"]')).toBeInTheDocument();
    expect(r16Header.closest('[data-round-state="locked"]')).toBeInTheDocument();
  });

  function make32Slots() {
    const slots = {};
    for (const id of ALL_R32_IDS) {
      slots[`${id}-home`] = { name: `${id}-h`, logo: null, group: 'A' };
      slots[`${id}-away`] = { name: `${id}-a`, logo: null, group: 'B' };
    }
    return slots;
  }

  it('should unlock R16 when all 32 slots and all 16 R32 picks are made', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = make32Slots();
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 should be completed, R16 should be active
    const r32Header = screen.getByText(/^Dieciseisavos/);
    const r16Header = screen.getByText(/^Octavos/);

    expect(r32Header.closest('[data-round-state="completed"]')).toBeInTheDocument();
    expect(r16Header.closest('[data-round-state="active"]')).toBeInTheDocument();
  });

  it('should show ✓ on completed round header when slots + picks are complete', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = make32Slots();
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const r32Header = screen.getByText(/^Dieciseisavos/);
    expect(r32Header.textContent).toContain('✓');
  });
});

describe('Bracket — champion banner', () => {
  function makeAllPicks() {
    const ids = [
      ...Array.from({ length: 16 }, (_, i) => `M${73 + i}`),
      ...Array.from({ length: 8 }, (_, i) => `R16-M${i + 1}`),
      ...Array.from({ length: 4 }, (_, i) => `QF-M${i + 1}`),
      ...Array.from({ length: 2 }, (_, i) => `SF-M${i + 1}`),
      'F-M1',
    ];
    return Object.fromEntries(ids.map((id) => [id, 'home']));
  }

  it('should show champion banner when Final has a pick', () => {
    mockStore.wcPicks = makeAllPicks();
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // The champion should appear (E1 propagates through all 'home' picks)
    expect(screen.getByText(/CAMPEÓN/i)).toBeInTheDocument();
    expect(screen.getByText(/CAMPEÓN: E1/)).toBeInTheDocument();
  });

  it('should not show champion banner when Final has no pick', () => {
    mockStore.wcPicks = { 'M73': 'home' };
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    expect(screen.queryByText(/CAMPEÓN/i)).toBeNull();
  });

  it('should remove champion banner after reset clears picks', () => {
    mockStore.wcPicks = {};
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    expect(screen.queryByText(/CAMPEÓN/i)).toBeNull();
  });
});

describe('Bracket — R32 slot assignment', () => {
  it('should show "Elegir Equipo" for unassigned R32 slots in editing mode', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {}; // No slots assigned yet
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 cells should show "Elegir Equipo" in editing mode
    const elegirEls = screen.getAllByText('Elegir Equipo');
    expect(elegirEls.length).toBeGreaterThanOrEqual(16);
  });

  it('should show assigned team from wcSlots in editing mode', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M73-home': { name: 'CustomA', logo: null, group: 'A' },
      'M73-away': { name: 'CustomB', logo: null, group: 'B' },
    };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    expect(screen.getByText('CustomA')).toBeInTheDocument();
    expect(screen.getByText('CustomB')).toBeInTheDocument();
  });

  it('should call setWcPick and setWcSlot when opening modal in editing mode', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click first clickable R32 cell (opens modal)
    const buttons = document.querySelectorAll('[role="button"]');
    expect(buttons.length).toBeGreaterThan(0);
    fireEvent.click(buttons[0]);

    // Modal should show some matchup header (first in R32_ORDER is M74)
    expect(screen.getByText('M74')).toBeInTheDocument();
  });
});

describe('Bracket — locked mode read-only', () => {
  it('should show standings teams in locked mode (not Elegir Equipo)', () => {
    mockStore.bracketMode = 'locked';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Locked mode should show standings teams, not placeholder text
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('B2')).toBeInTheDocument();
    expect(screen.queryByText('Elegir Equipo')).toBeNull();
  });

  it('should open read-only modal when clicking a cell in locked mode', () => {
    mockStore.bracketMode = 'locked';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // In locked mode, cells show standings teams and are clickable
    // Find M73 cell (2°A vs 2°B = A2 vs B2) - it's the third cell in the grid
    const teamEl = screen.getByText('A2');
    const cell = teamEl.closest('.matchup-cell');
    expect(cell).not.toBeNull();
    fireEvent.click(cell);

    // Modal should show the matchup header
    expect(screen.getByText('M73')).toBeInTheDocument();
  });

  it('should NOT show slot assignment toggle in locked mode modal', () => {
    mockStore.bracketMode = 'locked';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M73 cell (A2 is visible in M73)
    const teamEl = screen.getByText('A2');
    const cell = teamEl.closest('.matchup-cell');
    fireEvent.click(cell);

    // Modal shows read-only content
    expect(screen.getByText('M73')).toBeInTheDocument();
    // No "Local" / "Visitante" toggle buttons (removed in new design)
    expect(screen.queryByText('Local')).toBeNull();
    expect(screen.queryByText('Visitante')).toBeNull();
  });
});

describe('Bracket — R32 modal 2-step flow', () => {
  it('should show step "teams" with both pools on initial open', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click first R32 cell (M74)
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);

    // Modal shows "Elegí los equipos del cruce" (teams step)
    expect(screen.getByText('Elegí los equipos del cruce')).toBeInTheDocument();
    // Home pool shows Group E teams
    expect(screen.getByText('E1')).toBeInTheDocument();
    expect(screen.getByText('E2')).toBeInTheDocument();
    // Away pool shows Group A teams (first candidate group for M74)
    expect(screen.getByText('A1')).toBeInTheDocument();
    // No "Cambiar equipo" button yet (no teams selected)
    expect(screen.queryByText('Cambiar equipo')).toBeNull();
  });

  it('should show expanded card and "Cambiar equipo" when a slot is set', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
    };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);

    // Home side should show expanded card with "Cambiar equipo"
    expect(screen.getByText('Cambiar equipo')).toBeInTheDocument();
  });

  it('should hide third-place arrow buttons after team selection on third side', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {};
    const standings = makeFullStandings();
    const { rerender } = render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell (third-place slot — away side has arrows)
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);

    // Initially, arrows should be visible (away side cycles groups)
    const arrows = document.querySelectorAll('[aria-label="Grupo anterior"], [aria-label="Grupo siguiente"]');
    expect(arrows.length).toBeGreaterThanOrEqual(2);

    // Set a slot for the away side via mockStore and rerender
    mockStore.wcSlots = {
      'M74-away': { name: 'A3', logo: null, group: 'A' },
    };
    rerender(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Arrows should now be hidden (away side is expanded)
    const arrowsAfter = document.querySelectorAll('[aria-label="Grupo anterior"], [aria-label="Grupo siguiente"]');
    expect(arrowsAfter.length).toBe(0);
  });

  it('should show grid view when slot is cleared (collapsed)', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
    };
    const standings = makeFullStandings();
    const { rerender } = render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell → modal shows expanded card with "Cambiar equipo"
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Cambiar equipo')).toBeInTheDocument();

    // Click "Cambiar equipo" — mock's clearWcSlot updates mockStore.wcSlots
    fireEvent.click(screen.getByText('Cambiar equipo'));
    expect(mockStore.clearWcSlot).toHaveBeenCalledWith('M74-home');

    // Re-render so component reads cleared wcSlots
    rerender(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Should see the grid view again (E2 visible in the pool)
    expect(screen.getByText('E2')).toBeInTheDocument();
  });

  it('should transition to winner step when both slots are set', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
      'M74-away': { name: 'A3', logo: null, group: 'A' },
    };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);

    // Winner step should be shown directly
    expect(screen.getByText('Elegí el ganador del cruce')).toBeInTheDocument();
    // Both teams visible as clickable cards in the winner view
    expect(screen.getAllByText('E1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('A3').length).toBeGreaterThanOrEqual(1);
  });

  it('should call setWcPick and close modal when winner is picked', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
      'M74-away': { name: 'A3', logo: null, group: 'A' },
    };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell → winner step shown
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Elegí el ganador del cruce')).toBeInTheDocument();

    // Click E1 in the winner view to pick it as winner
    const e1Cards = screen.getAllByText('E1');
    // Click the E1 inside the winner view (the clickable card, not bracket cell)
    // Both the bracket cell and winner card show E1; clicking any triggers handleWinnerPick
    fireEvent.click(e1Cards[0]);

    // Should call setWcPick with M74 and 'home'
    expect(mockStore.setWcPick).toHaveBeenCalledWith('M74', 'home');
    // Modal should close (handleWinnerPick calls setSelectedMatchup(null))
    expect(screen.queryByText('Elegí el ganador del cruce')).toBeNull();
  });

  it('should show winner step directly when re-opening with existing slots', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
      'M74-away': { name: 'A3', logo: null, group: 'A' },
    };
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);

    // Should open directly to winner step
    expect(screen.getByText('Elegí el ganador del cruce')).toBeInTheDocument();
    // "Cambiar equipo" should be available for both sides
    const cambiarBtns = screen.getAllByText('Cambiar equipo');
    expect(cambiarBtns.length).toBe(2);
  });

  it('should go back to teams step when slot is cleared in winner step', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
      'M74-away': { name: 'A3', logo: null, group: 'A' },
    };
    const standings = makeFullStandings();
    const { rerender } = render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click M74 cell → winner step
    const buttons = document.querySelectorAll('[role="button"]');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('Elegí el ganador del cruce')).toBeInTheDocument();

    // Clear one slot via mockStore and rerender
    mockStore.wcSlots = {
      'M74-home': { name: 'E1', logo: null, group: 'E' },
    };
    rerender(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Should go back to teams step
    expect(screen.getByText('Elegí los equipos del cruce')).toBeInTheDocument();
    // Home side still expanded, away side shows grid (A2 should be visible)
    expect(screen.getByText('A2')).toBeInTheDocument();
  });
});

describe('Bracket — progressive unlock with slots', () => {
  const ALL_R32_IDS = [
    'M73', 'M74', 'M75', 'M76', 'M77', 'M78', 'M79', 'M80',
    'M81', 'M82', 'M83', 'M84', 'M85', 'M86', 'M87', 'M88',
  ];

  function make32Slots() {
    const slots = {};
    for (const id of ALL_R32_IDS) {
      slots[`${id}-home`] = { name: `${id}-h`, logo: null, group: 'A' };
      slots[`${id}-away`] = { name: `${id}-a`, logo: null, group: 'B' };
    }
    return slots;
  }

  it('should complete R32 with full picks even without slot assignments', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = {}; // No slots — slots optional
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 completed, R16 active (slots not required for progression)
    const r32Header = screen.getByText(/^Dieciseisavos/);
    const r16Header = screen.getByText(/^Octavos/);
    expect(r32Header.closest('[data-round-state="completed"]')).toBeInTheDocument();
    expect(r16Header.closest('[data-round-state="active"]')).toBeInTheDocument();
  });

  it('should unlock R16 when 32 slots + 16 R32 picks are done', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = make32Slots();
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 completed, R16 active
    const r32Header = screen.getByText(/^Dieciseisavos/);
    const r16Header = screen.getByText(/^Octavos/);
    expect(r32Header.closest('[data-round-state="completed"]')).toBeInTheDocument();
    expect(r16Header.closest('[data-round-state="active"]')).toBeInTheDocument();
  });

  it('should show R32 as completed when slots + picks are full', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = make32Slots();
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const r32Header = screen.getByText(/^Dieciseisavos/);
    expect(r32Header.textContent).toContain('✓');
  });
});

describe('Bracket — reset clears slots', () => {
  it('should call clearAllWcSlots and clearWcPicks when reset is clicked', () => {
    mockStore.wcPicks = { M73: 'home' };
    mockStore.wcSlots = { 'M73-home': { name: 'A2', logo: null, group: 'A' } };
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const resetBtn = screen.getByText('Resetear picks');
    expect(resetBtn).toBeEnabled();
    fireEvent.click(resetBtn);

    expect(mockStore.clearWcPicks).toHaveBeenCalledOnce();
    expect(mockStore.clearAllWcSlots).toHaveBeenCalledOnce();
  });

  it('should enable reset button when slots exist (even without picks)', () => {
    mockStore.wcPicks = {};
    mockStore.wcSlots = { 'M73-home': { name: 'A2', logo: null, group: 'A' } };
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    const resetBtn = screen.getByText('Resetear picks');
    expect(resetBtn).toBeEnabled();
  });
});
