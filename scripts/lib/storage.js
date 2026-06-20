// Storage module for data pipeline
// Única pieza que cambiaría al migrar a serverless KV/Blob
// Todos los paths son relativos a ./data/

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Load JSON from a file relative to data/
 * @param {string} relativePath - Path relative to data/ dir
 * @returns {any|null} Parsed JSON or null if file doesn't exist or is invalid
 */
export function loadJSON(relativePath) {
  const fullPath = join(DATA_DIR, relativePath);
  try {
    if (!existsSync(fullPath)) return null;
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save JSON to a file relative to data/
 * @param {string} relativePath - Path relative to data/ dir
 * @param {any} data - Data to serialize
 */
export function saveJSON(relativePath, data) {
  ensureDataDir();
  const fullPath = join(DATA_DIR, relativePath);
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Deep equality check via JSON.stringify
 * @param {any} newData
 * @param {any} existingData
 * @returns {boolean} true if data has changed
 */
export function hasChanges(newData, existingData) {
  return JSON.stringify(newData) !== JSON.stringify(existingData);
}

/**
 * Save matches for a given date. Only writes if data changed.
 * @param {string} date - YYYY-MM-DD date string
 * @param {Array} matches - Array of normalized Match objects
 * @returns {boolean} true if data was written (changed)
 */
export function saveMatches(date, matches) {
  const filename = `matches-${date}.json`;
  const existing = loadJSON(filename);
  const changed = hasChanges(matches, existing);

  if (changed) {
    saveJSON(filename, matches);
    return true;
  }
  return false;
}

/**
 * Save standings data. Only writes if data changed.
 * @param {Array} data - Array of {group, teams} objects
 * @returns {boolean} true if data was written (changed)
 */
export function saveStandings(data) {
  const existing = loadJSON('standings.json');
  const changed = hasChanges(data, existing);

  if (changed) {
    saveJSON('standings.json', data);
    return true;
  }
  return false;
}

/**
 * Save schedule data. Only writes if data changed.
 * @param {any} data - Schedule data object
 * @returns {boolean} true if data was written (changed)
 */
export function saveSchedule(data) {
  const existing = loadJSON('schedule.json');
  const changed = hasChanges(data, existing);

  if (changed) {
    saveJSON('schedule.json', data);
    return true;
  }
  return false;
}

/**
 * Save metadata about last fetch. Only writes if data changed.
 * @param {Object} data - Meta object { lastFetched, source, mode, ... }
 * @returns {boolean} true if data was written (changed)
 */
export function saveMeta(data) {
  const existing = loadJSON('meta.json');
  const changed = hasChanges(data, existing);

  if (changed) {
    saveJSON('meta.json', data);
    return true;
  }
  return false;
}
