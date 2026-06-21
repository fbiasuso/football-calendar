# wc-slot-pools Specification

## Purpose

Generate and browse team pools for assigning 32 R32 slots. Fixed pools (4 teams, one group) and third-place pools (rank-3 teams from candidate groups with arrow cycling).

## Requirements

### Requirement: Pool Generation

Fixed slots SHALL pool exactly 4 teams from that group. Third-place slots SHALL pool rank-3 teams from `THIRD_PLACE_CANDIDATES` groups.

#### Scenario: Fixed pool from group A

- GIVEN standings with 4 teams in Group A
- WHEN user opens slot M73
- THEN home pool SHALL show those 4 teams

#### Scenario: Third-place pool cycling

- GIVEN rank-3 teams in groups A/B/C/D/F
- WHEN user opens M74 away pool
- THEN pool SHALL show 5 cards, arrows cycle A→B→C→D→F→A

#### Scenario: Missing group data

- GIVEN group D standings unavailable for M74
- THEN pool SHALL omit it, cycle across available groups

### Requirement: Slot Assignment

Each slot SHALL allow assigning one team from its pool. `wcSlots[slotId] = { name, logo, group } | null`.

#### Scenario: Assign and clear

- GIVEN 4 teams in M73 pool
- WHEN user clicks a team card
- THEN `wcSlots['M73']` SHALL contain that team's data
- WHEN user clicks the same card again
- THEN slot SHALL revert to null

### Requirement: Locked Pool Display

Locked mode SHALL show pool read-only: team name, logo, group source. No arrows or selection controls.

#### Scenario: Read-only view

- GIVEN locked mode, M79 has an assigned team
- WHEN user views M79
- THEN modal SHALL show team, logo, group source only
