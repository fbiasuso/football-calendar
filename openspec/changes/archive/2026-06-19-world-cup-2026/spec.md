# World Cup 2026 Section — Specification

## Purpose

Add a "Mundial 2026" tab with group standings, R32 bracket with third-place simulation, and World Cup match integration in the main list.

---

## App Navigation

### Requirement: Top-Level Tabs

The system MUST provide two navigation tabs: "Partidos" (default active) and "Mundial 2026". Tab state MUST be stored in Zustand as `currentView: 'matches' | 'worldcup'`. The WC page MUST render sub-tabs "Grupos" (default) and "Llaves" stored as `wcTab: 'grupos' | 'llaves'`. Switching views MUST NOT use React Router.

#### Scenario: Default view is Partidos

- GIVEN the user opens the app
- WHEN the page loads
- THEN the active tab is "Partidos" AND the match list renders

#### Scenario: Switch to Mundial 2026

- GIVEN the user is on Partidos view
- WHEN the user clicks "Mundial 2026"
- THEN `currentView` is `'worldcup'` AND the WC page renders with "Grupos" sub-tab active

#### Scenario: Switch sub-tabs on WC page

- GIVEN the user is on the WC page with Grupos visible
- WHEN the user clicks "Llaves"
- THEN the bracket view replaces the standings grid

#### Scenario: NavBar highlights active tab

- GIVEN the user is on the World Cup view
- THEN the "Mundial 2026" tab has a visual active indicator AND "Partidos" does not

---

## WC Group Standings

### Requirement: Group Standings Grid

The system MUST fetch standings from the API and render 12 group tables (A through L) in a 4×3 responsive grid. Each table MUST show columns: Pos, team+logo, Pts, PJ, G, E, P, GF, GC, DG.

#### Scenario: Successful load renders grid

- GIVEN the API returns standings for 12 groups
- WHEN the user views the "Grupos" tab
- THEN a 4×3 grid of GroupTable components renders
- AND each table shows all group teams with complete stats

#### Scenario: Loading state

- GIVEN standings are being fetched
- WHEN the "Grupos" tab renders
- THEN a centered loading spinner is shown

#### Scenario: API error with retry

- GIVEN the API call fails
- WHEN the "Grupos" tab renders
- THEN an error message with a "Reintentar" button is displayed

#### Scenario: Empty data pre-tournament

- GIVEN no standings data exists yet (pre-tournament)
- WHEN the user views "Grupos"
- THEN "No hay datos" empty state is shown

---

## Group Table Component

### Requirement: Group Table Stats

The component MUST render a single group as a table with: position number, team name with logo, Pts, PJ, G, E, P, GF, GC, DG. The group leader (position 1) MUST have a visual highlight.

#### Scenario: Full table renders

- GIVEN standings data for group A is available
- WHEN GroupTable renders
- THEN all stat columns display correctly
- AND position 1 has a visual highlight (e.g., green tint)

---

## WC Bracket (Llaves)

### Requirement: R32 Matchups Display

The system MUST render 16 R32 matchups showing group pairings (e.g., "1°A vs 2°C"). Non-simulated matchups with live fixture data MUST link to the existing MatchCard component.

#### Scenario: Bracket renders known pairings

- GIVEN the user is on "Llaves"
- WHEN the bracket loads
- THEN 16 matchups display with the official FIFA 2026 R32 pairings:
  - Fixed (8): M73 (2A vs 2B), M75 (1F vs 2C), M76 (1C vs 2F), M78 (2E vs 2I), M83 (2K vs 2L), M84 (1H vs 2J), M86 (1J vs 2H), M88 (2D vs 2G)
  - Third-place (8): M74 (1E vs 3rd), M77 (1I vs 3rd), M79 (1A vs 3rd), M80 (1L vs 3rd), M81 (1D vs 3rd), M82 (1G vs 3rd), M85 (1B vs 3rd), M87 (1K vs 3rd)

#### Scenario: Non-simulated matches are tappable

- GIVEN a matchup has a corresponding fixture in match data
- WHEN the user clicks the matchup
- THEN it navigates to or reveals the match details

---

### Requirement: Simulation Algorithm (thirdPlaceRanker)

The system MUST provide `thirdPlaceRanker(groups)` that ranks all 12 third-placed teams by (1) points descending, (2) goal difference descending, (3) goals for descending, selects the top 8, and assigns them to R32 slots using FIFA's official per-slot candidate-group greedy algorithm:

- M74 (vs 1E): candidate groups [A, B, C, D, F]
- M77 (vs 1I): candidate groups [C, D, F, G, H]
- M79 (vs 1A): candidate groups [C, E, F, H, I]
- M80 (vs 1L): candidate groups [E, H, I, J, K]
- M81 (vs 1D): candidate groups [B, E, F, I, J]
- M82 (vs 1G): candidate groups [A, E, H, I, J]
- M85 (vs 1B): candidate groups [E, F, G, I, J]
- M87 (vs 1K): candidate groups [D, E, I, J, L]

Each third-placed team can only be assigned once (tracked via `usedGroups`). A team cannot be assigned to a slot if it would face its own group's winner (self-match prevention).

#### Scenario: Standard 12-group simulation

- GIVEN all 12 groups have third-place data
- WHEN `thirdPlaceRanker` runs
- THEN it returns an ordered array of 8 assigned third-place teams
- AND each team has a `slotIndex` (0–7), `opponentGroup` (e.g., "1°B"), and `isSimulated: true`

#### Scenario: Tiebreaker — goal difference

- GIVEN two third-place teams have equal points
- WHEN the ranker sorts them
- THEN the team with higher GD ranks above

#### Scenario: Tiebreaker — goals for

- GIVEN two third-place teams have equal points AND equal GD
- WHEN the ranker sorts them
- THEN the team with more GF ranks above

#### Scenario: Candidate-group constraint enforced

- GIVEN the ranked third-place teams
- WHEN assigning to slot 0 (faces winner of group E)
- THEN only teams from groups A–D are eligible
- AND the highest-ranked eligible team is selected

#### Scenario: Fewer than 8 third-place teams available

- GIVEN only 6 groups have complete third-place data
- WHEN `thirdPlaceRanker` runs
- THEN it returns assignments for available teams only
- AND remaining slots have `isSimulated: false` with `team: null`

#### Scenario: Group self-match prevented

- GIVEN the algorithm must assign a team from group X
- WHEN the only candidate slot faces winner of group X
- THEN the algorithm skips that candidate and assigns the next-ranked eligible team

---

### Requirement: Simular Button

A "Simular" button MUST appear on the Llaves tab. It MUST be disabled when standings data is unavailable and show a loading state during computation. On completion, the bracket updates with simulated pairings.

#### Scenario: Button enabled with data

- GIVEN standings are loaded
- WHEN the user views "Llaves"
- THEN the "Simular" button is enabled

#### Scenario: Button disabled without data

- GIVEN standings are not loaded (error / empty)
- WHEN the user views "Llaves"
- THEN the "Simular" button is disabled

#### Scenario: Button loading state

- GIVEN the user clicks "Simular"
- WHEN the algorithm is running
- THEN the button shows a spinner AND is disabled

---

### Requirement: Simulation Badge

Each simulated matchup MUST display a visible "SIMULACIÓN" badge and show the predicted third-place team name.

#### Scenario: Badge renders for simulated matchups

- GIVEN simulation has completed
- WHEN the bracket renders
- THEN each simulated matchup shows a "SIMULACIÓN" badge
- AND the assigned third-place team name is displayed

---

## API Integration

### Requirement: getStandings Endpoint

The API client MUST provide `getStandings(leagueId, season)` calling `/standings?league={id}&season={year}`. It MUST parse the response into a per-group structure with teams and their full stats.

#### Scenario: Successful fetch returns groups

- GIVEN the API key is valid
- WHEN `getStandings(1, 2026)` is called
- THEN it returns an array of group objects ({ group: 'A', teams: [...] })
- AND each team entry includes rank, name, logo, points, goalsFor, goalsAgainst, played, wins, draws, losses

#### Scenario: Error with retry

- GIVEN the API returns HTTP 429
- WHEN `getStandings` is called
- THEN it retries with exponential backoff (matching existing `fetchWithRetry` pattern)
- AND throws a descriptive error after exhausting retries

---

### Requirement: getRounds Endpoint

The API client MUST provide `getRounds(leagueId, season)` calling `/fixtures/rounds?league={id}&season={year}` returning round name strings.

#### Scenario: Successful fetch

- GIVEN the API key is valid
- WHEN `getRounds(1, 2026)` is called
- THEN it returns an array of round name strings (e.g., "Group Stage", "Round of 32")

---

## League Configuration

### Requirement: World Cup in League Config

The system MUST add `'World Cup 2026': 1` to `API_FOOTBALL_LEAGUE_IDS`, create a `mundial` group in `LEAGUE_GROUPS`, and include `'World Cup 2026'` in `DEFAULT_SELECTED_LEAGUES`.

#### Scenario: World Cup appears in filter

- GIVEN the league config is updated
- WHEN the user opens the LeagueFilter
- THEN a "Mundial" group is visible with "World Cup 2026" checkbox pre-selected

---

## Match List Integration

### Requirement: WC Fixtures in Main View

The system MUST include World Cup 2026 fixtures in the daily match list alongside other leagues, filtered by the standard league filter mechanism.

#### Scenario: WC matches visible in Partidos

- GIVEN there are WC matches on the selected date
- WHEN the user is on "Partidos" with "World Cup 2026" selected
- THEN WC matches appear in the match list with normal MatchCard rendering

#### Scenario: WC matches hidden when deselected

- GIVEN the user deselects "World Cup 2026" in the filter
- WHEN viewing "Partidos"
- THEN WC matches are excluded from the list
