// scripts/seed-teams.js
// Seed teams from API-Football into Supabase (direct PG connection)
// Usage: SUPABASE_DB_PASSWORD=xxx node scripts/seed-teams.js

import pg from 'pg';
import { LEAGUE_IDS } from '../src/utils/leagueConfig.js';

const { Pool } = pg;

const PASSWORD = process.env.VITE_SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
const API_KEY = process.env.VITE_FOOTBALL_API_KEY;

const pool = new Pool({
  host: 'db.dzciajbrbkkskvwrxlaw.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const SEASON = 2026;
const API_BASE = 'https://v3.football.api-sports.io';

async function fetchTeams(leagueApiId) {
  const url = `${API_BASE}/teams?league=${leagueApiId}&season=${SEASON}`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': API_KEY, Accept: 'application/json' },
  });
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length) throw new Error(Object.values(data.errors).join(', '));
  return (data.response || []).map(item => ({
    api_id: item.team.id,
    name: item.team.name,
    logo: item.team.logo || null,
  }));
}

async function main() {
  if (!PASSWORD || !API_KEY) {
    console.error('❌ Need SUPABASE_DB_PASSWORD and VITE_FOOTBALL_API_KEY');
    process.exit(1);
  }

  const client = await pool.connect();
  console.log('✅ Connected\n');

  try {
    // Get league internal IDs
    const { rows: leagues } = await client.query('SELECT id, api_id, name FROM leagues');
    console.log(`📋 Found ${leagues.length} leagues\n`);

    for (const league of leagues) {
      console.log(`👥 Fetching teams for ${league.name} (api_id=${league.api_id})...`);
      try {
        const teams = await fetchTeams(league.api_id);
        let count = 0;
        for (const team of teams) {
          // Upsert team
          const { rows: inserted } = await client.query(
            `INSERT INTO teams (api_id, name, logo) VALUES ($1,$2,$3)
             ON CONFLICT (api_id) DO UPDATE SET name=EXCLUDED.name, logo=EXCLUDED.logo
             RETURNING id`,
            [team.api_id, team.name, team.logo]
          );
          const teamId = inserted[0].id;

          // Upsert roster link
          await client.query(
            `INSERT INTO team_rosters (league_id, team_id, season) VALUES ($1,$2,$3)
             ON CONFLICT (league_id, team_id, season) DO NOTHING`,
            [league.id, teamId, SEASON]
          );
          count++;
        }
        console.log(`   ✅ ${count} teams`);
      } catch (err) {
        console.warn(`   ⚠️  ${err.message}`);
      }
    }

    const { rows: [{ c }] } = await client.query('SELECT COUNT(*)::int AS c FROM teams');
    const { rows: [{ r }] } = await client.query('SELECT COUNT(*)::int AS r FROM team_rosters');
    console.log(`\n✅ Done: ${c} teams, ${r} roster links`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
