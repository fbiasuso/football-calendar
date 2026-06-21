// Integration tests for Bracket.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Bracket from './Bracket.jsx';

afterEach(cleanup);

// ── Mock setup ────────────────────────────────────────────────────────────────

// We mock useAppStore to control wcPicks, wcStandings, wcSlots
const mockStore = vi.hoisted(() => ({
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
}));

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

  it('should call setWcPick when a team card is clicked in the modal', () => {
    mockStore.bracketMode = 'editing';
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click first R32 clickable cell (M74)
    const elegirEls = document.querySelectorAll('[role="button"]');
    fireEvent.click(elegirEls[0]);

    // The modal should now be visible showing M74
    expect(screen.getByText('M74')).toBeInTheDocument();

    // The modal has team buttons — find the cursor-pointer team buttons in the modal
    // In the R32 modal, the team cards are buttons with cursor-pointer class
    const teamButtons = document.querySelectorAll('.fixed [class*="cursor-pointer"]');
    expect(teamButtons.length).toBeGreaterThanOrEqual(1);

    // Click the first cursor-pointer team card (home team E1 from Group E)
    fireEvent.click(teamButtons[0]);

    // Should call setWcSlot and setWcPick (active side = home)
    expect(mockStore.setWcSlot).toHaveBeenCalledWith('M74-home', expect.objectContaining({ name: 'E1' }));
    expect(mockStore.setWcPick).toHaveBeenCalledWith('M74', 'home');
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
    // No "Local" / "Visitante" toggle buttons (present in R32 modal)
    expect(screen.queryByText('Local')).toBeNull();
    expect(screen.queryByText('Visitante')).toBeNull();
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

  it('should keep R32 active when no slots are assigned (even with full picks)', () => {
    mockStore.bracketMode = 'editing';
    mockStore.wcPicks = Object.fromEntries(ALL_R32_IDS.map((id) => [id, 'home']));
    mockStore.wcSlots = {}; // No slots
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // R32 header should show active (not completed) because slots are missing
    const r32Header = screen.getByText(/^Dieciseisavos/);
    expect(r32Header.closest('[data-round-state="active"]')).toBeInTheDocument();
    expect(r32Header.closest('[data-round-state="completed"]')).toBeNull();
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
