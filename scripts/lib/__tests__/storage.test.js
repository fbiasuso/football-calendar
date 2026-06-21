import { describe, it, expect, afterAll } from 'vitest';
import { rmSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { hasChanges, loadJSON, saveJSON, saveMatches } from '../storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');

// Clean up test artifacts after all tests
afterAll(() => {
  if (existsSync(DATA_DIR)) {
    const testFiles = readdirSync(DATA_DIR)
      .filter(f => f.startsWith('__test_') || f.startsWith('matches-test-'));
    for (const f of testFiles) {
      rmSync(join(DATA_DIR, f), { force: true });
    }
  }
});

describe('hasChanges', () => {
  it('returns false for identical objects', () => {
    const a = { name: 'Test', score: 5 };
    const b = { name: 'Test', score: 5 };
    expect(hasChanges(a, b)).toBe(false);
  });

  it('returns true for different objects', () => {
    const a = { name: 'Test', score: 5 };
    const b = { name: 'Test', score: 10 };
    expect(hasChanges(a, b)).toBe(true);
  });

  it('returns true for different array lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(hasChanges(a, b)).toBe(true);
  });

  it('returns false for identical arrays', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(hasChanges(a, b)).toBe(false);
  });

  it('returns true when second arg is null', () => {
    expect(hasChanges('hello', null)).toBe(true);
  });

  it('returns false when both are null', () => {
    expect(hasChanges(null, null)).toBe(false);
  });

  it('returns true for nested object changes', () => {
    const a = { teams: [{ name: 'A' }, { name: 'B' }] };
    const b = { teams: [{ name: 'A' }, { name: 'C' }] };
    expect(hasChanges(a, b)).toBe(true);
  });

  it('returns false for deeply nested identical objects', () => {
    const obj = {
      groups: [
        { group: 'A', teams: [{ name: 'X', pts: 3 }, { name: 'Y', pts: 1 }] },
      ],
    };
    expect(hasChanges(obj, JSON.parse(JSON.stringify(obj)))).toBe(false);
  });

  it('handles undefined gracefully', () => {
    expect(hasChanges({ a: undefined }, { b: 1 })).toBe(true);
  });
});

describe('saveJSON and loadJSON', () => {
  it('round-trips data correctly', () => {
    const data = { hello: 'world', arr: [1, 2, 3] };
    // Use a temp path
    saveJSON('__test_roundtrip.json', data);
    const loaded = loadJSON('__test_roundtrip.json');
    expect(loaded).toEqual(data);
  });

  it('loadJSON returns null for non-existent file', () => {
    const result = loadJSON('__nonexistent_file_xyz.json');
    expect(result).toBeNull();
  });
});

describe('saveMatches', () => {
  it('writes matches file on first save', () => {
    const matches = [
      { id: '1', title: 'A vs B', status: 'pending' },
    ];
    const changed = saveMatches('test-01', matches);
    expect(changed).toBe(true);

    // Verify file exists
    const loaded = loadJSON('matches-test-01.json');
    expect(loaded).toEqual(matches);
  });

  it('returns false if data unchanged', () => {
    const matches = [
      { id: '1', title: 'A vs B', status: 'pending' },
    ];
    // First save
    saveMatches('test-02', matches);
    // Second save with same data
    const changed = saveMatches('test-02', matches);
    expect(changed).toBe(false);
  });

  it('returns true if data changed', () => {
    const initial = [{ id: '1', title: 'A vs B', status: 'pending' }];
    const updated = [{ id: '1', title: 'A vs B', status: 'live', score: { home: 1, away: 0 } }];

    saveMatches('test-03', initial);
    const changed = saveMatches('test-03', updated);
    expect(changed).toBe(true);
  });
});
