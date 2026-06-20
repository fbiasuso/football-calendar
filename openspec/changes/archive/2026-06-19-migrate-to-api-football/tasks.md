# Tasks: Migrate to API-Football

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300-400 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: Config & Infrastructure

- [x] 1.1 Add `VITE_API_FOOTBALL_API_KEY` to `.env.example` (1 line)
- [x] 1.2 Add `/api/api-football` proxy rule to `vite.config.js` (no rewrite, keep football-data proxy)
- [x] 1.3 Add `API_FOOTBALL_LEAGUE_IDS` map to `leagueConfig.js` (13 league IDs, update libertadores group)
- [x] 1.4 Check `leagueConfig.js` updated `Copa Sudamericana` reference — it's already in libertadores group (no change)

## Phase 2: New API Client

- [x] 2.1 Create `src/api/apiFootball.js` with `fetchWithRetry` (x-apisports-key auth, exponential backoff)
- [x] 2.2 Add `mapStatus()` — map 19 API-Football short codes to `pending|live|finished`
- [x] 2.3 Add `isKnockoutRound()` — regex `/Round of 16|Quarter|Semi|Final/i`
- [x] 2.4 Add `normalizeMatch()` — raw fixture → Match with `isKnockout`, `round`, `season`, `leagueId`
- [x] 2.5 Add `getMatches(date)` — calls `/fixtures?date=YYYY-MM-DD`, filters by league config, normalizes
- [x] 2.6 Add `getLiveMatches()` — calls `/fixtures?live=all`, filters/normalizes
- [x] 2.7 Add `getCompetitions()` — derives from `API_FOOTBALL_LEAGUE_IDS` map (no API call)
- [x] 2.8 Add `getMatchById(id)` — calls `/fixtures?id={id}`, returns normalized Match
- [x] 2.9 Add `findFirstLegMatch(match)` — calls `/fixtures/headtohead?h2h=id1-id2&season=YYYY`, filters by date < current match

## Phase 3: Wire New Client

- [x] 3.1 Update `adapter.js` — change all 5 dynamic imports from `./footballData.js` to `./apiFootball.js`
- [x] 3.2 Update `adapter.js` Match typedef — add `isKnockout`, `round`, `season`, `leagueId` fields
- [x] 3.3 Update `useMatches.js` — change `CACHE_EXPIRY` from 30min to 60min; skip cache write if any match is live
- [x] 3.4 Update `MatchCard.jsx` — remove `KNOCKOUT_STAGES` constant, destructure `isKnockout` instead of `stage`
- [x] 3.5 Update `MatchCard.jsx` — change `isKnockoutMatch` to use `match.isKnockout && match.status === 'finished'`
- [x] 3.6 Update `MatchCard.jsx` — simplify `handleShowAggregate` to pass Match object directly to `findFirstLegMatch`

## Phase 4: Verify

- [x] 4.1 Smoke test: `npm run dev` starts without errors
- [x] 4.2 Verify proxy: `/api/api-football/fixtures?date=2026-06-19` returns data (manual curl or browser)
- [x] 4.3 Verify match list loads all leagues, scores display correctly
- [x] 4.4 Verify "Ver Global" on a knockout match loads aggregate (e.g., Champions League Round of 16)
- [x] 4.5 Verify filter/sort/date-nav still works (no regression)
