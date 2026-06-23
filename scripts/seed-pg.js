// scripts/seed-pg.js
// Direct Postgres seed (bypasses PostgREST which blocks service_role on new Supabase keys)
// Usage: node scripts/seed-pg.js
// Requires env: SUPABASE_DB_PASSWORD

import pg from 'pg';
import { API_FOOTBALL_LEAGUE_IDS, LEAGUE_GROUPS, DEFAULT_SELECTED_LEAGUES } from '../src/utils/leagueConfig.js';

const { Pool } = pg;

const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const HOST = 'db.dzciajbrbkkskvwrxlaw.supabase.co';

const pool = new Pool({
  host: HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const SEASON = 2026;

async function main() {
  if (!PASSWORD) {
    console.error('❌ SUPABASE_DB_PASSWORD env var required');
    process.exit(1);
  }

  const client = await pool.connect();
  console.log('✅ Connected to database\n');

  try {
    // ── 1. Leagues ────────────────────────────────────────────────
    console.log('📋 Seeding leagues...');
    const leagueToGroup = {};
    for (const [, group] of Object.entries(LEAGUE_GROUPS)) {
      for (const name of group.leagues) {
        leagueToGroup[name] = group.name;
      }
    }

    let order = 0;
    for (const [name, apiId] of Object.entries(API_FOOTBALL_LEAGUE_IDS)) {
      order++;
      const groupName = leagueToGroup[name] || 'Otros';
      const defaultSel = DEFAULT_SELECTED_LEAGUES.includes(name);

      await client.query(`
        INSERT INTO leagues (api_id, name, logo, season, group_name, display_order, default_sel)
        VALUES ($1, $2, NULL, $3, $4, $5, $6)
        ON CONFLICT (api_id) DO UPDATE SET
          name = EXCLUDED.name,
          season = EXCLUDED.season,
          group_name = EXCLUDED.group_name,
          display_order = EXCLUDED.display_order,
          default_sel = EXCLUDED.default_sel
      `, [apiId, name, SEASON, groupName, order, defaultSel]);

      console.log(`   ✅ ${name}`);
    }

    // ── 2. Bracket Nodes ──────────────────────────────────────────
    console.log('\n🏟️  Seeding bracket nodes...');
    const r32Order = ['M74','M77','M73','M75','M83','M84','M81','M82',
                      'M76','M78','M79','M80','M86','M88','M85','M87'];

    const fixedMatchups = {
      M73: { home: '2°A', away: '2°B' }, M75: { home: '1°F', away: '2°C' },
      M76: { home: '1°C', away: '2°F' }, M78: { home: '2°E', away: '2°I' },
      M83: { home: '2°K', away: '2°L' }, M84: { home: '1°H', away: '2°J' },
      M86: { home: '1°J', away: '2°H' }, M88: { home: '2°D', away: '2°G' },
    };

    const thirdPlace = {
      M74: { home: '1°E', candidates: 'A,B,C,D,F' }, M77: { home: '1°I', candidates: 'C,D,F,G,H' },
      M79: { home: '1°A', candidates: 'C,E,F,H,I' }, M80: { home: '1°L', candidates: 'E,H,I,J,K' },
      M81: { home: '1°D', candidates: 'B,E,F,I,J' }, M82: { home: '1°G', candidates: 'A,E,H,I,J' },
      M85: { home: '1°B', candidates: 'E,F,G,I,J' }, M87: { home: '1°K', candidates: 'D,E,I,J,L' },
    };

    let nodes = r32Order.map((id, idx) => ({
      id, round: 'R32', round_index: 0, matchup_index: idx,
      home_source: (fixedMatchups[id] || thirdPlace[id]).home,
      away_source: fixedMatchups[id]?.away || null,
      is_third_place: !!thirdPlace[id],
      candidate_groups: thirdPlace[id]?.candidates || null,
      grid_row_start: idx * 2 + 3, grid_row_span: 2, grid_col: 1,
    }));

    const r16Pairs = [['M74','M77'],['M73','M75'],['M83','M84'],['M81','M82'],
                      ['M76','M78'],['M79','M80'],['M86','M88'],['M85','M87']];

    r16Pairs.forEach(([h, a], i) => {
      nodes.push({
        id: `R16-M${i+1}`, round: 'R16', round_index: 1, matchup_index: i,
        home_source: h, away_source: a, is_third_place: false, candidate_groups: null,
        grid_row_start: i * 4 + 4, grid_row_span: 4, grid_col: 3,
      });
    });

    const qfPairs = [['R16-M1','R16-M2'],['R16-M3','R16-M4'],['R16-M5','R16-M6'],['R16-M7','R16-M8']];
    qfPairs.forEach(([h, a], i) => {
      nodes.push({
        id: `QF-M${i+1}`, round: 'QF', round_index: 2, matchup_index: i,
        home_source: h, away_source: a, is_third_place: false, candidate_groups: null,
        grid_row_start: i * 8 + 6, grid_row_span: 8, grid_col: 5,
      });
    });

    const sfPairs = [['QF-M1','QF-M2'],['QF-M3','QF-M4']];
    sfPairs.forEach(([h, a], i) => {
      nodes.push({
        id: `SF-M${i+1}`, round: 'SF', round_index: 3, matchup_index: i,
        home_source: h, away_source: a, is_third_place: false, candidate_groups: null,
        grid_row_start: i * 16 + 10, grid_row_span: 16, grid_col: 7,
      });
    });

    nodes.push({
      id: 'F-M1', round: 'F', round_index: 4, matchup_index: 0,
      home_source: 'SF-M1', away_source: 'SF-M2', is_third_place: false, candidate_groups: null,
      grid_row_start: 18, grid_row_span: 4, grid_col: 9,
    });

    for (const n of nodes) {
      await client.query(`
        INSERT INTO bracket_nodes (id, round, round_index, matchup_index, home_source, away_source,
          is_third_place, candidate_groups, grid_row_start, grid_row_span, grid_col)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          round = EXCLUDED.round, round_index = EXCLUDED.round_index,
          matchup_index = EXCLUDED.matchup_index, home_source = EXCLUDED.home_source,
          away_source = EXCLUDED.away_source, is_third_place = EXCLUDED.is_third_place,
          candidate_groups = EXCLUDED.candidate_groups, grid_row_start = EXCLUDED.grid_row_start,
          grid_row_span = EXCLUDED.grid_row_span, grid_col = EXCLUDED.grid_col
      `, [n.id, n.round, n.round_index, n.matchup_index, n.home_source, n.away_source,
          n.is_third_place, n.candidate_groups, n.grid_row_start, n.grid_row_span, n.grid_col]);
    }
    console.log(`   ✅ ${nodes.length} brackets seeded`);

    console.log('\n═══════════════════════════════════════');
    console.log('✅ Seed complete!');
    console.log(`   • ${Object.keys(API_FOOTBALL_LEAGUE_IDS).length} leagues`);
    console.log(`   • ${nodes.length} bracket nodes`);
    console.log('═══════════════════════════════════════');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
