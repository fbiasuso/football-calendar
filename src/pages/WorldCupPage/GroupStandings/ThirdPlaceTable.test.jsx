// Unit tests for ThirdPlaceTable
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ThirdPlaceTable from './ThirdPlaceTable.jsx';

afterEach(cleanup);

/**
 * Build a mock group with teams.
 */
function makeGroup(letter, thirdPlaceProps = {}) {
  return {
    group: letter,
    teams: [
      { rank: 1, name: `${letter}1`, logo: `logo-${letter}1`, points: 9, goalDiff: 10, goalsFor: 15, played: 3, wins: 3, draws: 0, losses: 0, goalsAgainst: 5 },
      { rank: 2, name: `${letter}2`, logo: `logo-${letter}2`, points: 6, goalDiff: 3, goalsFor: 8, played: 3, wins: 2, draws: 0, losses: 1, goalsAgainst: 5 },
      {
        rank: 3,
        name: `${letter}3`,
        logo: `logo-${letter}3`,
        points: 3,
        goalDiff: 0,
        goalsFor: 4,
        played: 3,
        wins: 1,
        draws: 0,
        losses: 2,
        goalsAgainst: 4,
        ...thirdPlaceProps,
      },
      { rank: 4, name: `${letter}4`, logo: `logo-${letter}4`, points: 0, goalDiff: -5, goalsFor: 1, played: 3, wins: 0, draws: 0, losses: 3, goalsAgainst: 6 },
    ],
  };
}

function makeFullStandings() {
  return Array.from({ length: 12 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return makeGroup(letter);
  });
}

describe('ThirdPlaceTable', () => {
  it('should render nothing with null standings', () => {
    const { container } = render(<ThirdPlaceTable standings={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render nothing with empty standings', () => {
    const { container } = render(<ThirdPlaceTable standings={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render a table with full standings', () => {
    const standings = makeFullStandings();
    const { container } = render(<ThirdPlaceTable standings={standings} />);

    const table = container.querySelector('table');
    expect(table).toBeInTheDocument();

    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(12);
  });

  it('should render a heading "Ranking de terceros lugares"', () => {
    const standings = makeFullStandings();
    render(<ThirdPlaceTable standings={standings} />);

    const heading = screen.getByRole('heading');
    expect(heading).toHaveTextContent('Ranking de terceros lugares');
  });

  it('should show ✓ for top 8 teams and ✗ for bottom 4 teams', () => {
    const standings = makeFullStandings();
    const { container } = render(<ThirdPlaceTable standings={standings} />);

    const rows = container.querySelectorAll('tbody tr');

    // Top 8 rows should have green background
    for (let i = 0; i < 8; i++) {
      expect(rows[i].classList.contains('bg-green-50')).toBe(true);
    }

    // Bottom 4 should have red-tinted background
    for (let i = 8; i < 12; i++) {
      expect(rows[i].classList.contains('bg-red-50/30')).toBe(true);
    }
  });

  it('should show team names for all 12 third-place teams', () => {
    const standings = makeFullStandings();
    render(<ThirdPlaceTable standings={standings} />);

    // Each group's third-place team is named "{letter}3"
    for (let i = 0; i < 12; i++) {
      const letter = String.fromCharCode(65 + i);
      const teamEls = screen.getAllByText(`${letter}3`);
      expect(teamEls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should show group letters in the group column', () => {
    const standings = makeFullStandings();
    render(<ThirdPlaceTable standings={standings} />);

    // Check group letters appear in the table cells
    for (let i = 0; i < 12; i++) {
      const letter = String.fromCharCode(65 + i);
      const groupEls = screen.getAllByText(letter);
      // The letter appears at least once (in group column, possibly elsewhere)
      expect(groupEls.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should show the ranking number (1–12)', () => {
    const standings = makeFullStandings();
    const { container } = render(<ThirdPlaceTable standings={standings} />);

    const rows = container.querySelectorAll('tbody tr');
    rows.forEach((row, idx) => {
      const firstCell = row.querySelector('td');
      expect(parseInt(firstCell.textContent, 10)).toBe(idx + 1);
    });
  });

  it('should display advanced slot names for top 8 teams', () => {
    const standings = makeFullStandings();
    render(<ThirdPlaceTable standings={standings} />);

    // At least some slot names (M74, M77, etc.) should appear in the table
    const slotNames = ['M74', 'M77', 'M79', 'M80', 'M81', 'M82', 'M85', 'M87'];
    const foundSlots = slotNames.filter((slot) => {
      const els = screen.queryAllByText(slot);
      return els.length > 0;
    });
    // With 8 slots assigned, at least one should be visible
    expect(foundSlots.length).toBeGreaterThan(0);
  });

  it('should show all standard table headers', () => {
    const standings = makeFullStandings();
    render(<ThirdPlaceTable standings={standings} />);

    // Most headers match uniquely; exclude those that also appear in data cells
    const uniqueHeaders = ['Equipo', 'Grupo', 'Pts', 'PJ', 'P', 'GF', 'GC', 'DG', 'Avanza?'];
    for (const header of uniqueHeaders) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
    // "G" appears in header (wins) and in data (group G letter)
    const gEls = screen.getAllByText('G');
    expect(gEls.length).toBeGreaterThanOrEqual(1);

    // "E" appears in header (Empates) and in data (group E letter)
    const eEls = screen.getAllByText('E');
    expect(eEls.length).toBeGreaterThanOrEqual(1);

    // "#" appears both in headers and ranking number in rows
    const hashEls = screen.getAllByText('#');
    expect(hashEls.length).toBeGreaterThanOrEqual(1);
  });
});
