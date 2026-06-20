# Proposal: Migrate to API-Football

## Intent

Replace football-data.org with API-Football (api-sports.io v3) as the primary match data source. The current API has limited league coverage (no Argentine leagues) and its free tier is more restrictive for our use case. API-Football gives us access to Argentine leagues and better fixture data for a cleaner implementation.

## Scope

### In Scope
- New `src/api/apiFootball.js` client with all adapter-mapped functions
- Update `src/api/adapter.js` to dynamically import the new client
- Add `apiFootballId` field to `leagueConfig.js` entries
- Add Vite proxy for `/api/api-football` → `https://v3.football.api-sports.io`
- Add `VITE_API_FOOTBALL_API_KEY` to `.env.example`
- Update `MatchCard.jsx` knockout detection: use `isKnockout` from agnostic Match interface instead of `stage`-based heuristic
- Keep `footballData.js` as backup (untouched)

### Out of Scope
- Adding Argentine leagues—deferred to a follow-up change
- Removing football-data.org code or config
- Auto-polling UX or toggle changes (already exists in store)
- UI redesign or component restructure

## Capabilities

### New Capabilities
None — this is a pure integration layer swap with no new spec-level behaviors.

### Modified Capabilities
None — existing capabilities (match list, scores, aggregate, filtering, sorting) preserve their current spec-level behavior. Only the integration implementation changes.

## Approach

1. Create `src/api/apiFootball.js` exposing the same function signatures as `footballData.js`, each normalizing API-Football responses to the agnostic Match interface (including `isKnockout` set by the client)
2. Update `adapter.js` to import `apiFootball.js` instead of `footballData.js`
3. Add league IDs (API-Football format) to `leagueConfig.js`
4. Configure proxy + env var for the new API
5. Remove `stage`-based knockout heuristic from `MatchCard.jsx`—use `isKnockout` from Match object

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/api/apiFootball.js` | **New** | API-Football v3 client with fixture → Match normalization |
| `src/api/adapter.js` | Modified | Dynamic import changes to `./apiFootball.js` |
| `src/api/footballData.js` | Unchanged | Kept as backup |
| `src/utils/leagueConfig.js` | Modified | Add `apiFootballId` (int) to each league entry |
| `src/components/MatchCard/MatchCard.jsx` | Modified | `stage` → `isKnockout` check |
| `vite.config.js` | Modified | Add `/api/api-football` proxy |
| `.env.example` | Modified | Add `VITE_API_FOOTBALL_API_KEY` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| API-Football 100 req/day limit exhausted | Medium | Aggressive caching, polling off by default, per-match status caching |
| Fixture status mapping mismatch | Low | Verify each API-Football short code maps correctly — integration test on known fixtures |
| Head-to-head endpoint unexpected format | Low | Handle gracefully via `findFirstLegMatch` return of `null` |

## Rollback Plan

Revert `adapter.js` to import `footballData.js`. Delete `apiFootball.js`. Revert `vite.config.js`, `.env.example`, `leagueConfig.js`, and `MatchCard.jsx`. No data migration needed—cache expires naturally.

## Dependencies

- GitHub issue or project board update to reflect API key change
- Coordination with any CI build-step that injects env vars

## Success Criteria

- [ ] Matches load from live API-Football data for all configured leagues
- [ ] Status mapping (NS→pending, 1H/2H→live, FT→finished) works on real fixtures
- [ ] "Ver Global" aggregate uses head-to-head endpoint and returns correct scores
- [ ] `isKnockout` boolean is correctly set for knockout-stage matches
- [ ] Cache layer reduces API calls — no more than 3 calls on initial load
- [ ] All existing UI behavior preserved (filtering, sorting, date nav, auto-poll toggle)
