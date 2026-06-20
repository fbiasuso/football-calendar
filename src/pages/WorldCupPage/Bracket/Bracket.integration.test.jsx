// Integration tests for Bracket.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Bracket from './Bracket.jsx';

afterEach(cleanup);

// ── Mock setup ────────────────────────────────────────────────────────────────

// We mock useAppStore to control wcPicks and wcStandings
const mockStore = vi.hoisted(() => ({
  wcStandings: null,
  wcPicks: {},
  setWcPick: vi.fn(),
  clearWcPicks: vi.fn(),
}));

vi.mock('../../../store/useAppStore.js', () => ({
  default: vi.fn((selector) => {
    const state = {
      wcStandings: mockStore.wcStandings,
      wcPicks: mockStore.wcPicks,
      setWcPick: mockStore.setWcPick,
      clearWcPicks: mockStore.clearWcPicks,
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

    // Round headers should be visible
    expect(screen.getByText('Dieciseisavos')).toBeInTheDocument();
    expect(screen.getByText('Octavos')).toBeInTheDocument();
    expect(screen.getByText('Cuartos')).toBeInTheDocument();
    expect(screen.getByText('Semifinales')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
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

    expect(screen.getByText(/2 picks activos/)).toBeInTheDocument();
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
  it('should open modal when a clickable R32 cell is clicked', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Find and click a team name in an R32 cell (e.g., A2 which is in M73)
    const teamEl = screen.getByText('A2');
    fireEvent.click(teamEl.closest('[role="button"]') || teamEl);

    // Modal should show the matchup info
    // The modal has role "button" and we look for the team names within it
    expect(screen.getByText('M73')).toBeInTheDocument();
  });

  it('should call setWcPick when a team card is clicked in the modal', () => {
    const standings = makeFullStandings();
    render(<Bracket standings={standings} loading={false} rankerResult={null} />);

    // Click on a clickable R32 cell to open the modal
    const teamEl = screen.getByText('A2');
    const cell = teamEl.closest('[role="button"]');
    expect(cell).not.toBeNull();
    fireEvent.click(cell);

    // The modal should now be visible showing M73
    expect(screen.getByText('M73')).toBeInTheDocument();

    // Find the cursor-pointer card divs in the modal (not the close button)
    // The home team card for M73 has cursor-pointer and contains "A2"
    const cursorCards = document.querySelectorAll('.fixed [class*="cursor-pointer"]');
    expect(cursorCards.length).toBeGreaterThanOrEqual(1);

    // Click the first cursor-pointer card (home team)
    // This triggers onClick which calls handlePick(m.id, 'home') → setWcPick(id, 'home')
    fireEvent.click(cursorCards[0]);

    expect(mockStore.setWcPick).toHaveBeenCalledWith('M73', 'home');
  });
});
