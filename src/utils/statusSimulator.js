// Status simulator for static mode (gh-pages)
// Computes estimated match status from scheduled start time + current time
// Real API data from static files takes priority when available

const FIRST_HALF = 45;
const STOPPAGE = 3;
const HALFTIME = 15;

/** Estimated duration of a standard football match in ms (45+3+15+45+3 = 111 min) */
export const NORMAL_DURATION_MS = (FIRST_HALF + STOPPAGE + HALFTIME + FIRST_HALF + STOPPAGE) * 60 * 1000;

/** Safety buffer for extra time (30 min) before force-closing a stuck-live match */
const ET_BUFFER_MS = 30 * 60 * 1000;

/**
 * Simulate match status based on scheduled start time and current time.
 *
 * Priority:
 * 1. File has `live` or `finished` → trust real data (with sanity check for stuck-live)
 * 2. File says `pending` → compute from schedule vs current time
 *
 * @param {Object} match - Match object with { date, status, ... }
 * @param {number} now - Current timestamp in ms (default: Date.now())
 * @returns {Object} New match object with overridden status/minute if simulated
 */
export function simulateMatchStatus(match, now = Date.now()) {
  const elapsed = now - match.date;

  // File has real API data — trust it
  if (match.status !== 'pending') {
    // Safety: force-close if stuck as 'live' way past the match window
    if (match.status === 'live' && elapsed >= NORMAL_DURATION_MS + ET_BUFFER_MS) {
      return { ...match, status: 'finished', minute: null };
    }
    return match;
  }

  // File says pending — simulate from schedule
  if (elapsed < 0) return match; // not started yet
  if (elapsed < NORMAL_DURATION_MS) {
    return { ...match, status: 'live', minute: null };
  }
  return { ...match, status: 'finished', minute: null };
}

export default simulateMatchStatus;
