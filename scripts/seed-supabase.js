// scripts/seed-supabase.js
// One-time seed script for Supabase database.
// Upserts leagues from leagueConfig.js, fetches teams from API-Football,
// populates team_rosters and bracket_nodes.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<key> \
//   VITE_API_FOOTBALL_API_KEY=<key> \
//   node scripts/seed-supabase.js
//
// If VITE_API_FOOTBALL_API_KEY is not set, teams/rosters are skipped
// (can be populated later by the Edge Function as matches arrive).

import { createClient } from '@supabase/supabase-js';

// ── Configuration ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const API_FOOTBALL_KEY = process.env.VITE_API_FOOTBALL_API_KEY || '';

const API_BASE_URL = 'https://v3.football.api-sports.io';
const SEASON = 2026;

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithRetry(endpoint, retries = 0) {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-apisports-key': API_FOOTBALL_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429 && retries < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        return fetchWithRetry(endpoint, retries + 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      const errorMsg = Object.values(data.errors).join(', ');
      throw new Error(`API-Football Error: ${errorMsg}`);
    }

    return data;
  } catch (error) {
    if (retries < 3) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(endpoint, retries + 1);
    }
    throw error;
  }
}

/**
 * Build league records from leagueConfig.js data.
 * @param {Object} apiIds - API_FOOTBALL_LEAGUE_IDS mapping { name: api_id }
 * @param {Object} groups - LEAGUE_GROUPS mapping { groupKey: { name, leagues[] } }
 * @param {string[]} defaultSelected - DEFAULT_SELECTED_LEAGUES array
 * @returns {Array<{api_id: number, name: string, season: number, group_name: string, display_order: number, default_sel: boolean}>}
 */
function buildLeagues(apiIds, groups, defaultSelected) {
  // Build a map of league name → group display name
  const leagueToGroup = {};
  const groupIndex = {};
  let idx = 0;

  for (const [, group] of Object.entries(groups)) {
    for (const leagueName of group.leagues) {
      leagueToGroup[leagueName] = group.name;
      groupIndex[leagueName] = idx;
    }
    idx++;
  }

  let order = 0;
  const leagues = [];

  for (const [name, apiId] of Object.entries(apiIds)) {
    order++;
    leagues.push({
      api_id: apiId,
      name,
      season: SEASON,
      logo: null,
      group_name: leagueToGroup[name] || 'Otros',
      display_order: order,
      default_sel: defaultSelected.includes(name),
    });
  }

  return leagues;
}

/**
 * Fetch teams participating in a league from API-Football.
 * @param {number} leagueApiId - API-Football league ID
 * @returns {Promise<Array<{api_id: number, name: string, logo: string}>>}
 */
async function fetchLeagueTeams(leagueApiId) {
  const data = await fetchWithRetry(`/teams?league=${leagueApiId}&season=${SEASON}`);
  return (data.response || []).map(item => ({
    api_id: item.team.id,
    name: item.team.name,
    logo: item.team.logo || null,
  }));
}

/**
 * Build bracket_nodes for World Cup 2026 knockout stage.
 * 31 matchups: 16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final.
 * @returns {Array<Object>} bracket node rows
 */
function buildBracketNodes() {
  // ── R32 matchups ───────────────────────────────────────────────────────────
  // R32 display order (visual bracket top → bottom per R32_ORDER)
  // Fields: id, homeSource, awaySource, isThirdPlace, candidateGroups, gridRowStart, gridCol
  const r32Order = ['M74', 'M77', 'M73', 'M75', 'M83', 'M84', 'M81', 'M82',
                    'M76', 'M78', 'M79', 'M80', 'M86', 'M88', 'M85', 'M87'];

  // Fixed matchups: both teams from group standings
  const fixedMatchupSources = {
    M73: { home: '2°A', away: '2°B' },
    M75: { home: '1°F', away: '2°C' },
    M76: { home: '1°C', away: '2°F' },
    M78: { home: '2°E', away: '2°I' },
    M83: { home: '2°K', away: '2°L' },
    M84: { home: '1°H', away: '2°J' },
    M86: { home: '1°J', away: '2°H' },
    M88: { home: '2°D', away: '2°G' },
  };

  // Third-place slots: home from standings, away from third-place ranking
  const thirdPlaceSources = {
    M74: { home: '1°E', candidates: 'A,B,C,D,F' },
    M77: { home: '1°I', candidates: 'C,D,F,G,H' },
    M79: { home: '1°A', candidates: 'C,E,F,H,I' },
    M80: { home: '1°L', candidates: 'E,H,I,J,K' },
    M81: { home: '1°D', candidates: 'B,E,F,I,J' },
    M82: { home: '1°G', candidates: 'A,E,H,I,J' },
    M85: { home: '1°B', candidates: 'E,F,G,I,J' },
    M87: { home: '1°K', candidates: 'D,E,I,J,L' },
  };

  const ROW_SPAN_R32 = 2;
  const GRID_COL_R32 = 1;

  const r32Nodes = r32Order.map((id, idx) => {
    const fixed = fixedMatchupSources[id];
    const third = thirdPlaceSources[id];
    const isThird = !!third;
    const homeSource = fixed ? fixed.home : third.home;
    const awaySource = fixed ? fixed.away : null;
    const candidateGroups = third ? third.candidates : null;
    const rowStart = idx * 2 + 3 + 0; // rowStart(0, idx) = idx*2^1 + 3 + 0

    return {
      id,
      round: 'R32',
      round_index: 0,
      matchup_index: idx,
      home_source: homeSource,
      away_source: awaySource,
      is_third_place: isThird,
      candidate_groups: candidateGroups,
      grid_row_start: rowStart,
      grid_row_span: ROW_SPAN_R32,
      grid_col: GRID_COL_R32,
    };
  });

  // ── R16 matchups ───────────────────────────────────────────────────────────
  // Derived from R32_PAIRS: each pair of R32 matchups feeds into one R16 matchup
  const r16Pairs = [
    ['M74', 'M77'],  // → R16-M1
    ['M73', 'M75'],  // → R16-M2
    ['M83', 'M84'],  // → R16-M3
    ['M81', 'M82'],  // → R16-M4
    ['M76', 'M78'],  // → R16-M5
    ['M79', 'M80'],  // → R16-M6
    ['M86', 'M88'],  // → R16-M7
    ['M85', 'M87'],  // → R16-M8
  ];

  const ROW_SPAN_R16 = 4;
  const GRID_COL_R16 = 3;

  const r16Nodes = r16Pairs.map(([homeSource, awaySource], idx) => {
    const rowStart = idx * 4 + 3 + 1; // rowStart(1, idx) = idx*2^2 + 3 + 1
    return {
      id: `R16-M${idx + 1}`,
      round: 'R16',
      round_index: 1,
      matchup_index: idx,
      home_source: homeSource,
      away_source: awaySource,
      is_third_place: false,
      candidate_groups: null,
      grid_row_start: rowStart,
      grid_row_span: ROW_SPAN_R16,
      grid_col: GRID_COL_R16,
    };
  });

  // ── QF matchups ────────────────────────────────────────────────────────────
  const qfPairs = [
    ['R16-M1', 'R16-M2'],  // → QF-M1
    ['R16-M3', 'R16-M4'],  // → QF-M2
    ['R16-M5', 'R16-M6'],  // → QF-M3
    ['R16-M7', 'R16-M8'],  // → QF-M4
  ];

  const ROW_SPAN_QF = 8;
  const GRID_COL_QF = 5;

  const qfNodes = qfPairs.map(([homeSource, awaySource], idx) => {
    const rowStart = idx * 8 + 3 + 3; // rowStart(2, idx) = idx*2^3 + 3 + 3
    return {
      id: `QF-M${idx + 1}`,
      round: 'QF',
      round_index: 2,
      matchup_index: idx,
      home_source: homeSource,
      away_source: awaySource,
      is_third_place: false,
      candidate_groups: null,
      grid_row_start: rowStart,
      grid_row_span: ROW_SPAN_QF,
      grid_col: GRID_COL_QF,
    };
  });

  // ── SF matchups ────────────────────────────────────────────────────────────
  const sfPairs = [
    ['QF-M1', 'QF-M2'],  // → SF-M1
    ['QF-M3', 'QF-M4'],  // → SF-M2
  ];

  const ROW_SPAN_SF = 16;
  const GRID_COL_SF = 7;

  const sfNodes = sfPairs.map(([homeSource, awaySource], idx) => {
    const rowStart = idx * 16 + 3 + 7; // rowStart(3, idx) = idx*2^4 + 3 + 7
    return {
      id: `SF-M${idx + 1}`,
      round: 'SF',
      round_index: 3,
      matchup_index: idx,
      home_source: homeSource,
      away_source: awaySource,
      is_third_place: false,
      candidate_groups: null,
      grid_row_start: rowStart,
      grid_row_span: ROW_SPAN_SF,
      grid_col: GRID_COL_SF,
    };
  });

  // ── Final ──────────────────────────────────────────────────────────────────
  const finalNode = {
    id: 'F-M1',
    round: 'F',
    round_index: 4,
    matchup_index: 0,
    home_source: 'SF-M1',
    away_source: 'SF-M2',
    is_third_place: false,
    candidate_groups: null,
    grid_row_start: 18,
    grid_row_span: 4,
    grid_col: 9,
  };

  return [...r32Nodes, ...r16Nodes, ...qfNodes, ...sfNodes, finalNode];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🏆 Football Calendar — Supabase Seed');
  console.log('═══════════════════════════════════════\n');

  if (!SUPABASE_URL) {
    console.error('❌ SUPABASE_URL environment variable is required.');
    process.exit(1);
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required.');
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: Load league configuration from the app source
  // Since this is an ESM project, we can use dynamic import
  console.log('📥 Loading league configuration...');
  let leagueConfig;
  try {
    leagueConfig = await import('../src/utils/leagueConfig.js');
  } catch (err) {
    console.error('❌ Could not load leagueConfig.js:', err.message);
    console.error('   Make sure you run this script from the project root.');
    process.exit(1);
  }

  const { API_FOOTBALL_LEAGUE_IDS, LEAGUE_GROUPS, DEFAULT_SELECTED_LEAGUES } = leagueConfig;
  const leagues = buildLeagues(API_FOOTBALL_LEAGUE_IDS, LEAGUE_GROUPS, DEFAULT_SELECTED_LEAGUES);
  console.log(`   Found ${leagues.length} leagues to seed.\n`);

  // Step 2: Upsert leagues and build api_id → internal id mapping
  // team_rosters FK references leagues(id) and teams(id) (auto-generated PKs),
  // not api_id. We need the internal PK for roster inserts.
  console.log('📋 Seeding leagues...');
  const leagueIdMap = new Map(); // api_id → internal id

  for (const league of leagues) {
    const { data, error } = await sb
      .from('leagues')
      .upsert(league, { onConflict: 'api_id' })
      .select();

    if (error) {
      console.error(`   ❌ ${league.name} (api_id=${league.api_id}):`, error.message);
    } else if (data && data.length > 0) {
      leagueIdMap.set(league.api_id, data[0].id);
      console.log(`   ✅ ${league.name} (id=${data[0].id})`);
    }
  }
  console.log();

  // Step 3: Fetch teams from API-Football and populate team_rosters
  if (API_FOOTBALL_KEY) {
    console.log('👥 Fetching teams from API-Football...');

    for (const league of leagues) {
      const leagueInternalId = leagueIdMap.get(league.api_id);
      if (!leagueInternalId) {
        console.warn(`   ⚠️  ${league.name}: no internal ID found, skipping teams.`);
        continue;
      }

      try {
        const teams = await fetchLeagueTeams(league.api_id);
        let count = 0;

        for (const team of teams) {
          // Upsert the team record and get internal ID
          const { data: teamData, error: teamError } = await sb
            .from('teams')
            .upsert(team, { onConflict: 'api_id' })
            .select();

          if (teamError) {
            console.error(`     ❌ Team ${team.name}: ${teamError.message}`);
            continue;
          }

          if (!teamData || teamData.length === 0) continue;
          const teamInternalId = teamData[0].id;

          // Link team to league via roster (using internal PKs)
          const { error: rosterError } = await sb
            .from('team_rosters')
            .upsert({
              league_id: leagueInternalId,
              team_id: teamInternalId,
              season: SEASON,
            }, { onConflict: 'league_id, team_id, season' });

          if (rosterError) {
            console.error(`     ❌ Roster ${team.name} → ${league.name}: ${rosterError.message}`);
            continue;
          }

          count++;
        }

        console.log(`   ✅ ${league.name}: ${count} teams processed`);
      } catch (err) {
        console.warn(`   ⚠️  ${league.name}: ${err.message} (teams will be populated when matches arrive)`);
      }
    }

    console.log();
  } else {
    console.log('👤 VITE_API_FOOTBALL_API_KEY not set — skipping team fetch.');
    console.log('   Teams and team_rosters can be populated later by the Edge Function.\n');
  }

  // Step 4: Seed bracket_nodes for World Cup 2026
  console.log('🏟️  Seeding bracket nodes for World Cup 2026...');
  const nodes = buildBracketNodes();
  let nodeCount = 0;

  for (const node of nodes) {
    const { error } = await sb
      .from('bracket_nodes')
      .upsert(node, { onConflict: 'id' });

    if (error) {
      console.error(`   ❌ ${node.id}: ${error.message}`);
    } else {
      nodeCount++;
    }
  }

  console.log(`   ✅ ${nodeCount}/${nodes.length} bracket nodes seeded.\n`);
  console.log('═══════════════════════════════════════');
  console.log('✅ Seed complete!');
  console.log(`   • ${leagues.length} leagues`);
  console.log(`   • ${nodeCount} bracket nodes`);
  console.log('═══════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
