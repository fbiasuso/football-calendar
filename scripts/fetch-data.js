#!/usr/bin/env node
// Entry point for data pipeline
// Orchestrates: schedule → api → storage
// Usage: node scripts/fetch-data.js
// Env: VITE_API_FOOTBALL_API_KEY (required), MODE (optional: 'worldcup'|'leagues')

import { getSchedule, isWorldCupPeriod } from './schedule.js';
import { getMatches, getLiveMatches, getStandings, getRounds, formatDate } from './lib/api.js';
import { loadJSON, saveMatches, saveStandings, saveSchedule, saveMeta, hasChanges } from './lib/storage.js';

const TODAY = new Date();
const TOMORROW = new Date(TODAY.getTime() + 24 * 60 * 60 * 1000);
const YESTERDAY = new Date(TODAY.getTime() - 24 * 60 * 60 * 1000);

/**
 * Get the mode from env or auto-detect from current date
 * @returns {'worldcup'|'leagues'}
 */
function detectMode() {
  if (process.env.MODE === 'worldcup') return 'worldcup';
  if (process.env.MODE === 'leagues') return 'leagues';
  return isWorldCupPeriod(TODAY) ? 'worldcup' : 'leagues';
}

/**
 * Build known fixtures array from saved match files for today and tomorrow
 * @returns {Array} Array of normalized Match objects
 */
function getKnownFixtures() {
  const todayKey = formatDate(TODAY);
  const tomorrowKey = formatDate(TOMORROW);
  const yesterdayKey = formatDate(YESTERDAY);

  const todayMatches = loadJSON(`matches-${todayKey}.json`);
  const tomorrowMatches = loadJSON(`matches-${tomorrowKey}.json`);
  const yesterdayMatches = loadJSON(`matches-${yesterdayKey}.json`);

  const fixtures = [];
  if (Array.isArray(yesterdayMatches)) fixtures.push(...yesterdayMatches);
  if (Array.isArray(todayMatches)) fixtures.push(...todayMatches);
  if (Array.isArray(tomorrowMatches)) fixtures.push(...tomorrowMatches);
  return fixtures;
}

async function main() {
  const mode = detectMode();
  console.log(`[fetch-data] Mode: ${mode}, Time: ${TODAY.toISOString()}`);

  // Load previous meta
  const meta = loadJSON('meta.json');
  const lastFetched = meta?.lastFetched ? new Date(meta.lastFetched) : null;

  // Get known fixtures from saved data
  const knownFixtures = getKnownFixtures();
  console.log(`[fetch-data] Known fixtures: ${knownFixtures.length}`);

  // Ask the scheduler
  const schedule = getSchedule({
    now: TODAY,
    knownFixtures,
    mode,
    lastFetched,
    meta,
  });

  if (!schedule.shouldFetch) {
    console.log(`[fetch-data] SKIP: ${schedule.reasons.join(', ')}`);
    process.exit(0);
  }

  console.log(`[fetch-data] FETCH: ${schedule.reasons.join(', ')}`);
  console.log(`[fetch-data] Endpoints: ${schedule.endpoints.join(', ')}`);

  const todayKey = formatDate(TODAY);
  const tomorrowKey = formatDate(TOMORROW);
  const yesterdayKey = formatDate(YESTERDAY);
  let changed = false;

  try {
    // Fetch fixtures for yesterday, today and tomorrow
    // yesterday cubre timezones UTC-x (ej: ART=UTC-3, pide día local)
    if (schedule.endpoints.includes('fixtures')) {
      console.log(`[fetch-data] Fetching matches for ${yesterdayKey}, ${todayKey} and ${tomorrowKey}...`);
      const [yesterdayMatches, todayMatches, tomorrowMatches] = await Promise.all([
        getMatches(yesterdayKey),
        getMatches(todayKey),
        getMatches(tomorrowKey),
      ]);

      const yesterdayChanged = saveMatches(yesterdayKey, yesterdayMatches);
      const todayChanged = saveMatches(todayKey, todayMatches);
      const tomorrowChanged = saveMatches(tomorrowKey, tomorrowMatches);
      if (yesterdayChanged) {
        console.log(`[fetch-data] Saved ${yesterdayMatches.length} matches for ${yesterdayKey} (changed)`);
        changed = true;
      } else {
        console.log(`[fetch-data] Matches for ${yesterdayKey} unchanged`);
      }
      if (todayChanged) {
        console.log(`[fetch-data] Saved ${todayMatches.length} matches for ${todayKey} (changed)`);
        changed = true;
      } else {
        console.log(`[fetch-data] Matches for ${todayKey} unchanged`);
      }
      if (tomorrowChanged) {
        console.log(`[fetch-data] Saved ${tomorrowMatches.length} matches for ${tomorrowKey} (changed)`);
        changed = true;
      } else {
        console.log(`[fetch-data] Matches for ${tomorrowKey} unchanged`);
      }

      // Save schedule (upcoming matches overview)
      const allUpcoming = [...yesterdayMatches, ...todayMatches, ...tomorrowMatches];
      saveSchedule({
        generatedAt: TODAY.toISOString(),
        today: todayKey,
        tomorrow: tomorrowKey,
        totalFixtures: allUpcoming.length,
        liveCount: allUpcoming.filter(m => m.status === 'live').length,
        pendingCount: allUpcoming.filter(m => m.status === 'pending').length,
        finishedCount: allUpcoming.filter(m => m.status === 'finished').length,
        mode,
      });
      console.log(`[fetch-data] Schedule saved`);
      changed = true;
    }

    // Fetch standings (always in World Cup mode, or if schedule says so)
    if (schedule.endpoints.includes('standings') || mode === 'worldcup') {
      console.log('[fetch-data] Fetching World Cup standings...');
      const standings = await getStandings(1, 2026);
      const standingsChanged = saveStandings(standings);
      if (standingsChanged) {
        console.log(`[fetch-data] Saved ${standings.length} groups (changed)`);
        changed = true;
      } else {
        console.log('[fetch-data] Standings unchanged');
      }
    }

    // Fetch live matches
    if (schedule.endpoints.includes('live')) {
      console.log('[fetch-data] Fetching live matches...');
      const liveMatches = await getLiveMatches();
      const liveChanged = saveMatches(`live`, liveMatches);
      if (liveChanged) {
        console.log(`[fetch-data] Saved ${liveMatches.length} live matches (changed)`);
        changed = true;
      } else {
        console.log('[fetch-data] Live matches unchanged');
      }
    }

    // Save meta on every successful fetch (timestamp always reflects last run)
    const newMeta = {
      lastFetched: TODAY.toISOString(),
      dataChanged: changed,
      source: 'api-football',
      mode,
      nextPlanned: schedule.nextPlanned.toISOString(),
      endpointsUsed: schedule.endpoints,
      fixturesToday: knownFixtures.length,
      liveNow: knownFixtures.filter(m => m.status === 'live').length,
    };
    saveMeta(newMeta);
    console.log(`[fetch-data] Meta saved (dataChanged: ${changed})`);

    process.exit(0);
  } catch (error) {
    console.error(`[fetch-data] ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
