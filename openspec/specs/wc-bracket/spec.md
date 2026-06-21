# wc-bracket Specification

## Purpose

Slot-based bracket pick'em for WC 2026. Assign 32 R32 slots from pools, then pick winners through 5 rounds via progressive unlock.

## Requirements

### Requirement: R32 Slot Modal

R32 modal SHALL show home/away pools with side toggle. Each side SHALL show team cards with name, logo, group. Third-place pools SHALL include group cycling arrows.

#### Scenario: Assign both sides

- GIVEN slot M73 (2°A vs 2°B)
- WHEN user assigns home from Group A, toggles away, assigns from Group B
- THEN `wcSlots['M73'].home` and `.away` SHALL be set, cell shows both teams

#### Scenario: Partial third-place assignment

- GIVEN M74 (1°E vs 3°?)
- WHEN user assigns home only
- THEN cell SHALL show "3° ?", round remains incomplete

### Requirement: R16+ Winner Modal

R16/QF/SF/Final SHALL use a 2-team click-to-pick modal.

#### Scenario: Pick R16 winner

- GIVEN both feeders have winners
- WHEN user clicks home team in R16-M1
- THEN `wcPicks['R16-M1']` = `'home'`, winner propagates

### Requirement: Locked Read-Only Modal

Locked mode SHALL show read-only modal with teams, logos, date, group, winner. No editable controls.

#### Scenario: Read-only display

- GIVEN locked mode, pick exists for R16-M1
- WHEN user clicks the matchup
- THEN modal SHALL show teams and winner, no clickable cards

### Requirement: Progressive Unlock

`computeRoundStates` SHALL require 32 slots assigned AND 16 R32 winners before R16 unlocks. Each later round needs all prior winners.

#### Scenario: Partial blocks next

- GIVEN 28 slots, 14 R32 winners
- WHEN `computeRoundStates` runs
- THEN R32=`active`, R16=`locked` (dimmed cells)

#### Scenario: Full unlocks

- GIVEN 32 slots, 16 R32 winners
- WHEN `computeRoundStates` runs
- THEN R16=`active`, R32=`completed`

### Requirement: Resolution Engine

`resolveBracket` SHALL accept optional `wcSlots`. When present, SHALL use slot values before standings. When absent, resolve from standings only.

#### Scenario: Slot override

- GIVEN `wcSlots` has M73 assigned
- WHEN `resolveBracket(picks, graph, standings, rankerResult, wcSlots)` runs
- THEN M73 SHALL use wcSlots values, not standings

#### Scenario: Standings fallback

- GIVEN no wcSlots (locked mode)
- WHEN `resolveBracket(picks, graph, standings, rankerResult)` runs
- THEN M73 SHALL resolve via `getTeamByRank`

### Requirement: Persistence

`wcSlots` SHALL be persisted via `partialize` with `wcPicks`. Survive tab switches and reload.

#### Scenario: Navigate and return

- GIVEN 4 slots assigned
- WHEN user switches to Grupos tab and back to Llaves
- THEN assignments SHALL remain in `wcSlots`
