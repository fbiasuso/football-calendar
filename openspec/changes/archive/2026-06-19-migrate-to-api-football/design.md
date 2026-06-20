# Design: Migrate to API-Football

## Technical Approach

Create `src/api/apiFootball.js` with the same exported interface as `footballData.js`, normalizing API-Football v3 responses to the agnostic Match interface (including `isKnockout` set client-side). Update `adapter.js` to dynamically import the new client. Add API-Football league ID mappings to `leagueConfig.js`. Adjust caching to respect the 100 req/day free tier. Minimal component changes: `MatchCard.jsx` uses `match.isKnockout` instead of hardcoded stage constants, and the aggregate flow calls `findFirstLegMatch` with the normalized Match object.

## Architecture Decisions

### Decision: Adapter dynamic import swap

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Inline conditional in adapter | Adds branching to every call; hard to clean up | |
| Dynamic import swap (existing pattern) | One-line change per function; `footballData.js` kept as backup | ✅ |
| Delete old client entirely | Against proposal scope; cleaner but risky rollback | |

**Rationale**: The adapter already uses dynamic import — we change the import path from `./footballData.js` to `./apiFootball.js`. The old client stays untouched.

### Decision: League ID mapping separate from `LEAGUE_GROUPS`

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Embed `apiFootballId` in each league entry object | Breaks `getAllLeagues()` and all callers expecting strings | |
| Separate `API_FOOTBALL_LEAGUE_IDS` map | Backward-compatible; no changes to existing league utils | ✅ |

**Rationale**: A flat `{ [leagueName]: number }` map in `leagueConfig.js` keeps all existing code working. The `apiFootball.js` client uses this map to translate API-Football's numeric league IDs to our display names.

### Decision: Cache live-match exclusion

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Uniform 60min expiry | Still wastes cache write on live dates | |
| **Skip cache if any match is live** | Zero stale live data; cache only completed/pending days | ✅ |
| Per-match expiry in cache | Complex; cache key is per-date, not per-match | |

**Rationale**: If ANY match on a date is live, we skip caching that date entirely. This costs one extra API call per poll but never serves stale live data. Finished/pending dates cache for 60 min.

### Decision: `findFirstLegMatch` uses head-to-head endpoint

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Competition-level search (current approach) | Requires 2-3 API calls; fragile date window | |
| **API-Football `/fixtures/headtohead`** | Single call; reliable h2h data; exact leg ordering | ✅ |

**Rationale**: The dedicated head-to-head endpoint returns all matches between two teams for a season. We filter by date to find the leg before the current match. This replaces the fragile competition-scoped search in footballData.js.

### Decision: Match interface includes `isKnockout` set by client

**Choice**: Client sets `isKnockout` during normalization; components never re-derive it.
**Alternatives**: Components check raw round strings (couples to API shape).
**Rationale**: API-Football uses round strings like `"Round of 16"`, `"Quarter-finals"`. The client regex-checks for `Round of 16|Quarter|Semi|Final` (case-insensitive) and sets the boolean. Components check `match.isKnockout` — no stage constants, no API coupling.

## Data Flow

```
API-Football (api-sports.io)
    │ GET /fixtures?date=YYYY-MM-DD
    │ Header: x-apisports-key
    ▼
Vite proxy (/api/api-football → v3.football.api-sports.io)
    │ No rewrite — API-Football paths are absolute (/fixtures)
    ▼
src/api/apiFootball.js
    ├── fetchWithRetry() — shared fetch + retry
    ├── normalizeMatch() — raw fixture → Match { isKnockout, round, ... }
    ├── mapStatus() — short codes → pending|live|finished
    └── getLeagues() — derives from leagueConfig (no API call)
    │
    ▼
src/api/adapter.js (dynamic import ./apiFootball.js)
    │ Same signatures: getMatches, getLiveMatches, getMatchById, findFirstLegMatch
    ▼
src/hooks/useMatches.js
    ├── Checks localStorage cache (60min, skipped if live matches)
    ├── Calls adapter.getMatches() on miss or force refresh
    └── Saves to cache (only if no live matches)
    │
    ▼
src/store/useAppStore.js (Zustand)
    │ matches[], filters by selectedLeagues
    ▼
src/components/MatchCard.jsx
    ├── Uses match.isKnockout for "Ver Global" button
    ├── Uses match.teams, match.score, match.status directly
    └── Aggregate flow: getMatchById(match.id) → findFirstLegMatch(match)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/api/apiFootball.js` | **Create** | API-Football v3 client: fetchWithRetry, normalizeMatch, mapStatus, 5 exported functions |
| `src/api/adapter.js` | Modify | Dynamic import `./apiFootball.js` instead of `./footballData.js`; update Match typedef with `isKnockout`, `round`, `season`, `leagueId` |
| `src/utils/leagueConfig.js` | Modify | Add `API_FOOTBALL_LEAGUE_IDS` map; add `Copa Sudamericana` to `libertadores` group |
| `src/components/MatchCard/MatchCard.jsx` | Modify | Remove `KNOCKOUT_STAGES`; use `match.isKnockout`; update aggregate flow to pass Match object |
| `vite.config.js` | Modify | Add `/api/api-football` proxy (no rewrite); keep existing football-data proxy |
| `.env.example` | Modify | Add `VITE_API_FOOTBALL_API_KEY` |
| `src/hooks/useMatches.js` | Modify | Change `CACHE_EXPIRY` to 60 min; skip cache if any match is live |

## Interfaces / Contracts

### Agnostic Match Interface (updated typedef in adapter.js)

```js
/**
 * @typedef {Object} Match
 * @property {string} id
 * @property {string} title
 * @property {number} date         - Unix timestamp ms
 * @property {string} league       - Display name (e.g. "Premier League")
 * @property {number} leagueId     - API-Football league ID
 * @property {Object} teams
 * @property {Object} teams.home
 * @property {string} teams.home.name
 * @property {string} teams.home.badge
 * @property {number} teams.home.id
 * @property {Object} teams.away
 * @property {string} teams.away.name
 * @property {string} teams.away.badge
 * @property {number} teams.away.id
 * @property {'pending'|'live'|'finished'} status
 * @property {Object} score
 * @property {number|null} score.home
 * @property {number|null} score.away
 * @property {number|null} minute
 * @property {string|null} round   - e.g. "Regular Season - 28", "Round of 16"
 * @property {boolean} isKnockout  - true when round contains knockout keywords
 * @property {number|null} season  - e.g. 2024
 */
```

### API-Football Status Mapping

| Short Code | Internal | Notes |
|------------|----------|-------|
| `NS`, `TBD`, `PST`, `INT` | `pending` | Not started, postponed, interrupted |
| `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `LIVE` | `live` | First half, halftime, second half, extra time, break, penalties in progress |
| `FT`, `AET`, `PEN`, `CANC`, `ABD`, `AWD`, `WO` | `finished` | Full time, after extra time, penalty shootout completed, cancelled, abandoned, awarded, walkover |

### Knockout Detection Regex (in normalizeMatch)

```js
function isKnockoutRound(round) {
  if (!round) return false;
  return /Round of 16|Quarter|Semi|Final/i.test(round);
}
```

### API-Football League ID Map (in leagueConfig.js)

```js
export const API_FOOTBALL_LEAGUE_IDS = {
  'UEFA Champions League': 2,
  'Copa Libertadores': 13,
  'Copa Sudamericana': 11,
  'Premier League': 39,
  'FA Cup': 45,
  'EFL Cup': 48,
  'LaLiga': 140,
  'Copa del Rey': 143,
  'Supercopa': 556,       // Supercopa de España
  'Serie A': 135,
  'Coppa Italia': 137,
  'Bundesliga': 78,
  'DFB-Pokal': 81,
};
```

## Aggregate Flow Changes

Current flow (footballData.js):
```
MatchCard.handleShowAggregate
  → getMatchById(id)           // returns { homeTeam, awayTeam, competition, season, utcDate }
  → findFirstLegMatch(details) // competition-scoped search, 15-day window
```

New flow (apiFootball.js):
```
MatchCard.handleShowAggregate
  → getMatchById(id)           // returns normalized Match
  → findFirstLegMatch(match)   // uses /fixtures/headtohead?h2h=team1-team2&season=X
```

**Key change**: `getMatchById` returns a full Match object. `findFirstLegMatch` extracts `match.teams.home.id`, `match.teams.away.id`, `match.season` directly. This simplifies MatchCard — no custom object construction.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Status mapping | `mapStatus` function: verify all 19 short codes map correctly |
| Unit | Knockout detection | `isKnockoutRound`: test round strings like "Round of 16", "Quarter-finals", "Regular Season - 21" |
| Unit | League ID mapping | Verify every `API_FOOTBALL_LEAGUE_IDS` entry resolves to a valid configured league in `LEAGUE_GROUPS` |
| Integration | Live API call | Run `getMatches(today)` against real API-Football, log results (manual smoke test with env key) |
| Integration | Head-to-head aggregate | Pick a known knockout tie, verify `findFirstLegMatch` returns correct scores |
| Manual | Full flow | Load app, verify matches display, scores show, "Ver Global" works on knockout matches, filter/sort unchanged |

## Migration / Rollout

No database or data migration required. Cache expires naturally. Env var `VITE_API_FOOTBALL_API_KEY` must be set before the app functions. Fallback: revert `adapter.js` import to `./footballData.js`, remove env var, delete proxy config — old client still works.

## Open Questions

None.
