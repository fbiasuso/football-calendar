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
import {
  getMatches, getLiveMatches, getStandings,
  getRemainingThisMinute, getRateLimitResetSeconds,
} from "./api.ts";
import { upsertMatches, upsertStandings, updatePipelineMeta, ensureColumns } from "./db.ts";

// Auto-migrate: ensure cache columns exist on cold start
ensureColumns().catch((err) => console.warn("[fetch-data] ensureColumns failed:", err.message));

export interface FetchDataResponse {
  fetched: boolean;
  reason: string;
  matchesUpserted: number;
  standingsUpserted: boolean;
  requestsRemainingMinute?: number;
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-request-id",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request): Promise<Response> => {
  const headers = { "Content-Type": "application/json", ...CORS_HEADERS };

  try {
    // ── CORS preflight ────────────────────────────────────────────────────
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

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
          endpoints: pipelineMeta.fast_mode === true ? ["fixtures", "live"] : ["fixtures", "live", "standings"],
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

    // Augment schedule: standings are always fetched alongside fixtures (unless fast mode)
    if (!pipelineMeta.fast_mode && schedule.endpoints.includes("fixtures") && !schedule.endpoints.includes("standings")) {
      (schedule as any).endpoints.push("standings");
    }

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

    // ── Fixture date cache from pipeline_meta ──────────────────────────────
    const fixtureCache: Record<string, string> = pipelineMeta.fixture_fetch_cache
      ? (typeof pipelineMeta.fixture_fetch_cache === "object" ? pipelineMeta.fixture_fetch_cache : {})
      : {};
    const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour for yesterday/tomorrow

    function isDateFresh(dateStr: string): boolean {
      const cached = fixtureCache[dateStr];
      if (!cached) return false;
      return now.getTime() - new Date(cached).getTime() < CACHE_MAX_AGE_MS;
    }

    // ── Execute fetch cycle ────────────────────────────────────────────────
    let matchesUpserted = 0;
    let standingsUpserted = false;
    const errors: string[] = [];
    const updatedFixtureCache = { ...fixtureCache };

    try {
      // Fetch fixtures — skip yesterday/tomorrow if cached within 1h
      if (schedule.endpoints.includes("fixtures")) {
        const datePromises: Promise<any>[] = [];

        // Today: always fetch
        datePromises.push(getMatches(todayStr));
        updatedFixtureCache[todayStr] = now.toISOString();

        // Yesterday: skip if fresh
        if (isDateFresh(yesterdayStr)) {
          console.log(`[fetch-data] Skipping ${yesterdayStr} (cached < 1h)`);
          datePromises.push(Promise.resolve([]));
        } else {
          datePromises.push(getMatches(yesterdayStr));
          updatedFixtureCache[yesterdayStr] = now.toISOString();
        }

        // Tomorrow: skip if fresh
        if (isDateFresh(tomorrowStr)) {
          console.log(`[fetch-data] Skipping ${tomorrowStr} (cached < 1h)`);
          datePromises.push(Promise.resolve([]));
        } else {
          datePromises.push(getMatches(tomorrowStr));
          updatedFixtureCache[tomorrowStr] = now.toISOString();
        }

        const [todayMatches, yesterdayMatches, tomorrowMatches] = await Promise.all(datePromises);

        const allMatches = [
          ...(Array.isArray(yesterdayMatches) ? yesterdayMatches : yesterdayMatches?.matches || []),
          ...todayMatches,
          ...(Array.isArray(tomorrowMatches) ? tomorrowMatches : tomorrowMatches?.matches || []),
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

    // Fetch official standings — only if "standings" in endpoints AND stale > 30 min
    if (schedule.endpoints.includes("standings")) {
      try {
        const standingsLastFetched = pipelineMeta.standings_last_fetched
          ? new Date(pipelineMeta.standings_last_fetched).getTime()
          : 0;
        const minutesSinceStandings = (now.getTime() - standingsLastFetched) / 60000;

        if (standingsLastFetched === 0 || minutesSinceStandings >= 30) {
          // Clear stale rows first (avoids duplicates when group_name format changes)
          await query(`DELETE FROM standings WHERE league_id = 1 AND season = 2026`);
          const standings = await getStandings(1, 2026);
          if (standings.length > 0) {
            const count = await upsertStandings(null, 1, 2026, standings, false);
            standingsUpserted = count > 0;
            console.log(`[fetch-data] Upserted ${count} official standings rows`);
          }
        } else {
          console.log(`[fetch-data] Standings skipped (${Math.round(minutesSinceStandings)} min since last fetch, need 30)`);
        }
      } catch (standingsErr: any) {
        console.error("[fetch-data] Standings fetch error:", standingsErr.message);
        errors.push(`standings: ${standingsErr.message}`);
      }
    } else {
      console.log(`[fetch-data] Standings skipped (not in endpoints)`);
    }

    // ── Rate-limit aware nextPlanned adjustment ────────────────────────────
    const remaining = getRemainingThisMinute();
    let adjustedNextPlanned = schedule.nextPlanned;
    if (remaining <= 2) {
      // Close to rate limit — extend interval to let the counter reset
      const extended = new Date(schedule.nextPlanned.getTime() + 60 * 1000);
      adjustedNextPlanned = extended;
      console.log(`[fetch-data] Rate limit close (${remaining} left), extending next fetch by 60s`);
    }

    // ── Update pipeline_meta ────────────────────────────────────────────────
    try {
      await updatePipelineMeta(null, {
        last_fetched: now.toISOString(),
        next_planned: adjustedNextPlanned.toISOString(),
        mode: mode as string,
        error_count: errors.length,
        last_error: errors.length > 0 ? errors[errors.length - 1] : null,
        standings_last_fetched: standingsUpserted ? now.toISOString() : undefined,
        fixture_fetch_cache: updatedFixtureCache,
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
      requestsRemainingMinute: remaining,
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
