// Edge Function entry point: fetch-data
// Triggered by cron-job.org POST requests.
// Orchestrates: read pipeline_meta → schedule → fetch API → upsert DB
//
// Secrets (available by default in Supabase Edge Function runtime):
//   SUPABASE_DB_URL               — Direct Postgres connection string
//   VITE_FOOTBALL_API_KEY         — football-data.org API key (set via supabase secrets set)

import pg from "npm:pg@8.13.0";
const { Pool } = pg;
const POOL = new Pool({ connectionString: Deno.env.get("SUPABASE_DB_URL"), max: 1 });

import { getSchedule, isWorldCupPeriod, type ScheduleDecision } from "./schedule.ts";
import { getMatches, getLiveMatches } from "./api.ts";
import { upsertMatches, upsertStandings, updatePipelineMeta } from "./db.ts";
import { computeStandings } from "./standings.ts";

export interface FetchDataResponse {
  fetched: boolean;
  reason: string;
  matchesUpserted: number;
  standingsUpserted: boolean;
  errors?: string[];
}

async function query(sql: string, params?: any[]): Promise<any[]> {
  const client = await POOL.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const headers = { "Content-Type": "application/json" };

  try {
    // ── Guard: only POST ───────────────────────────────────────────────────
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers },
      );
    }

    // ── Parse force param (from URL query OR request body) ──────────────────
    const url = new URL(req.url);
    let force = url.searchParams.get("force") === "true";

    if (!force) {
      try {
        const body = await req.clone().json();
        force = body?.force === true;
      } catch {
        // Body not JSON or empty — ignore
      }
    }

    if (force) {
      console.log("[fetch-data] FORCE mode — bypassing schedule");
    }

    // ── Check API key ─────────────────────────────────────────────────────
    const footballApiKey = Deno.env.get("VITE_FOOTBALL_API_KEY");

    if (!footballApiKey) {
      return new Response(
        JSON.stringify({ error: "Missing secret: VITE_FOOTBALL_API_KEY" }),
        { status: 500, headers },
      );
    }

    // ── Read pipeline_meta ─────────────────────────────────────────────────
    const pipelineRows = await query("SELECT * FROM pipeline_meta WHERE id = 1");

    if (pipelineRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "pipeline_meta row not found" }),
        { status: 500, headers },
      );
    }

    const pipelineMeta = pipelineRows[0];

    const now = new Date();
    console.log(
      `[fetch-data] Mode: ${pipelineMeta.mode}, Time: ${now.toISOString()}`,
    );

    // ── Resolve mode ───────────────────────────────────────────────────────
    if (pipelineMeta.mode === "off") {
      return new Response(
        JSON.stringify({
          fetched: false,
          reason: "Pipeline is OFF in pipeline_meta",
          matchesUpserted: 0,
          standingsUpserted: false,
        } as FetchDataResponse),
        { status: 200, headers },
      );
    }

    const mode = pipelineMeta.mode ||
      (isWorldCupPeriod(now) ? "worldcup" : "leagues");

    // ── Build knownFixtures from today's DB matches ────────────────────────
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const dbFixtures = await query(
      "SELECT id, date, status FROM matches WHERE date >= $1 AND date < $2",
      [todayStart.toISOString(), todayEnd.toISOString()],
    );

    const knownFixtures = (dbFixtures || []).map((m: any) => ({
      id: m.id,
      date: new Date(m.date).getTime(),
      status: (m.status === "scheduled" ? "pending" : m.status) as "pending" | "live" | "finished",
    }));

    // ── Resolve schedule ──────────────────────────────────────────────────
    // Force mode bypasses the scheduler and fetches immediately
    const schedule = force
      ? {
          shouldFetch: true,
          reasons: ["force: manual refresh"],
          nextPlanned: new Date(now.getTime() + 5 * 60 * 1000),
          endpoints: ["fixtures", "live"],
        } as ScheduleDecision
      : getSchedule({
          now,
          knownFixtures,
          mode: mode as "worldcup" | "leagues",
          lastFetched: pipelineMeta.last_fetched
            ? new Date(pipelineMeta.last_fetched)
            : null,
          meta: pipelineMeta.next_planned
            ? { nextPlanned: pipelineMeta.next_planned }
            : null,
          fastMode: pipelineMeta.fast_mode === true,
        });

    if (!schedule.shouldFetch) {
      console.log(`[fetch-data] SKIP: ${schedule.reasons.join(", ")}`);

      // Always persist nextPlanned so pipeline_meta advances
      await updatePipelineMeta(null, {
        next_planned: schedule.nextPlanned.toISOString(),
      }).catch((err) => {
        console.warn(
          "[fetch-data] Failed to update next_planned on skip:",
          err.message,
        );
      });

      return new Response(
        JSON.stringify({
          fetched: false,
          reason: schedule.reasons.join("; "),
          matchesUpserted: 0,
          standingsUpserted: false,
        } as FetchDataResponse),
        { status: 200, headers },
      );
    }

    console.log(`[fetch-data] FETCH: ${schedule.reasons.join(", ")}`);
    console.log(`[fetch-data] Endpoints: ${schedule.endpoints.join(", ")}`);

    // ── Date strings ───────────────────────────────────────────────────────
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${
        String(d.getDate()).padStart(2, "0")
      }`;

    const todayStr = fmt(now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = fmt(tomorrow);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = fmt(yesterday);

    // ── Execute fetch cycle ────────────────────────────────────────────────
    let matchesUpserted = 0;
    let standingsUpserted = false;
    const errors: string[] = [];

    try {
      // Fetch fixtures for yesterday, today, and tomorrow
      if (schedule.endpoints.includes("fixtures")) {
        const [yesterdayMatches, todayMatches, tomorrowMatches] =
          await Promise.all([
            getMatches(yesterdayStr),
            getMatches(todayStr),
            getMatches(tomorrowStr),
          ]);

        const allMatches = [
          ...yesterdayMatches,
          ...todayMatches,
          ...tomorrowMatches,
        ];

        if (allMatches.length > 0) {
          matchesUpserted = await upsertMatches(null, allMatches);
          console.log(`[fetch-data] Upserted ${matchesUpserted} matches`);
        }
      }

      // Fetch live matches
      if (schedule.endpoints.includes("live")) {
        const liveMatches = await getLiveMatches();
        if (liveMatches.length > 0) {
          const liveCount = await upsertMatches(null, liveMatches);
          console.log(`[fetch-data] Upserted ${liveCount} live matches`);
          matchesUpserted += liveCount;
        }
      }
    } catch (fetchError: any) {
      console.error("[fetch-data] Fetch/upsert error:", fetchError.message);
      errors.push(fetchError.message);
    }

    // Always compute standings (does not depend on API calls)
    try {
      const standings = await computeStandings(POOL);
      if (standings.length > 0) {
        const count = await upsertStandings(null, 1, 2026, standings, true);
        standingsUpserted = count > 0;
        console.log(`[fetch-data] Computed + upserted ${count} standings rows`);
      }
    } catch (computeErr: any) {
      console.error("[fetch-data] Standings computation error:", computeErr.message);
      errors.push(`standings: ${computeErr.message}`);
    }

    // ── Update pipeline_meta ────────────────────────────────────────────────
    try {
      await updatePipelineMeta(null, {
        last_fetched: now.toISOString(),
        next_planned: schedule.nextPlanned.toISOString(),
        mode: mode as string,
        error_count: errors.length,
        last_error: errors.length > 0 ? errors[errors.length - 1] : null,
      });
    } catch (metaErr: any) {
      console.warn("[fetch-data] pipeline_meta update error:", metaErr.message);
    }

    // ── Build response ─────────────────────────────────────────────────────
    const response: FetchDataResponse = {
      fetched: matchesUpserted > 0 || standingsUpserted,
      reason: schedule.reasons.join("; "),
      matchesUpserted,
      standingsUpserted,
      errors: errors.length > 0 ? errors : undefined,
    };

    return new Response(JSON.stringify(response), { status: 200, headers });
  } catch (error: any) {
    console.error("[fetch-data] Unhandled error:", error.message);

    return new Response(
      JSON.stringify({
        fetched: false,
        reason: `Unhandled error: ${error.message}`,
        matchesUpserted: 0,
        standingsUpserted: false,
      } as FetchDataResponse),
      { status: 500, headers },
    );
  }
});
