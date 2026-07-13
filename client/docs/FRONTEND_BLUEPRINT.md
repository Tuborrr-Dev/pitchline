# Frontend Blueprint

## Purpose

PITCHLINE is a real-time football match analysis product presented through the visual language of a trading terminal.

The frontend must translate live match probability changes into a surface that is:

- fast to read
- emotionally clear
- mobile-friendly
- credible to users who already understand charts

The frontend should avoid sportsbook language and instead use market language:

- probability
- market
- move
- volatility
- price

## Product Surfaces

The frontend should be designed around two main pages.

### 1. Match Lobby

Route:

- `/`

Purpose:

- let users scan live and upcoming matches quickly
- prioritize live matches
- provide enough context to choose a match without opening it

Core jobs:

- list live fixtures first
- show score or kickoff time
- show a mini probability view
- communicate match status clearly

### 2. Live Match View

Route:

- `/match/[fixtureId]`

Purpose:

- make the chart the primary storytelling surface
- show exactly what changed, when, and why
- support live event interpretation without requiring long text

Core jobs:

- display current state at a glance
- show probability movement in real time
- connect markers and narrative to the exact chart moment
- preserve state cleanly during reconnects

## Design Principles

### Chart First

The chart is the product. Everything else exists to support interpretation of the chart.

### Terminal, Not Dashboard

The visual system should feel closer to a market terminal than a modern SaaS analytics card layout.

### Mobile Priority

The app is expected to be used with a phone in hand during live matches. Mobile is not a compressed desktop layout. It is a first-class surface.

### Immediate Legibility

A user should understand the current match state within a few seconds:

- who is leading
- what the current probabilities are
- whether momentum just changed
- whether the feed is live

## Information Architecture

### Match Lobby Sections

- `HeroBar`
- `LiveNowSection`
- `UpcomingSection`
- `FooterInfo`

### Live Match View Sections

- `TopBar`
- `MatchHeader`
- `ProbabilityTicker`
- `ProbabilityChart`
- `EventTimelineStrip`
- `NarrativePanel`
- `SystemStatusBar`

## Shared Frontend Data Model

The UI should be built around stable frontend entities, even before backend integration.

### Fixture

Fields:

- `fixtureId`
- `teamAName`
- `teamACode`
- `teamBName`
- `teamBCode`
- `teamACrest?`
- `teamBCrest?`
- `competition`
- `stage?`
- `kickoffUtc`
- `status`
- `phase`
- `scoreA`
- `scoreB`

### ProbabilityPoint

Fields:

- `timestamp`
- `minuteLabel`
- `teamA`
- `draw`
- `teamB`

### MatchEvent

Fields:

- `eventId`
- `fixtureId`
- `type`
- `minuteLabel`
- `timestamp`
- `side?`
- `label`
- `detailLabel?`
- `delta?`
- `importance`

### NarrativeMoment

Fields:

- `eventId`
- `text`
- `createdAt`
- `reason`

### LiveMatchState

Fields:

- `fixture`
- `currentProbabilities`
- `history`
- `events`
- `activeNarrative?`
- `selectedTimestamp?`
- `connectionState`
- `lastUpdatedAt?`

## Connection State Model

The frontend should visibly handle feed state.

Possible values:

- `connecting`
- `live`
- `reconnecting`
- `stale`
- `offline`

Rules:

- never blank the chart during reconnect
- keep the last known state visible
- always show a visible status badge

## Component Plan

### Shared

- `ConnectionBadge`
- `WalletButton`
- `StatusChip`
- `ProbabilityStat`
- `SectionLabel`

### Lobby

- `HeroBar`
- `LiveMatchCard`
- `UpcomingMatchCard`
- `MiniSparkline`
- `LobbySection`

### Match View

- `TopBar`
- `MatchHeader`
- `ProbabilityTicker`
- `ProbabilityChart`
- `ChartLegend`
- `ChartReadout`
- `EventTimelineStrip`
- `TimelineEventChip`
- `NarrativePanel`
- `SystemStatusBar`

## Interaction Rules

- New live data updates the chart first.
- The ticker should reflect the most recent material change.
- Event markers and timeline chips must map to the same event identity.
- Selecting a timeline item should focus the same point on the chart.
- If an AI narrative arrives late, it attaches to the already-rendered event.
- Premium history scrubbing should extend the chart interaction model, not replace it.

## Event Type Display Rules

At minimum, the frontend should visually support:

- goal
- red card
- yellow card
- penalty awarded
- penalty scored
- penalty missed
- VAR review
- half time
- full time
- extra time
- penalty shootout

Each event needs:

- icon
- short label
- timeline chip style
- chart marker style
- optional narrative eligibility

## Route Plan

- `/`
- `/match/[fixtureId]`

Later extensions:

- `/history/[fixtureId]`
- gated multi-match view if premium is added as a dedicated page

## Wallet Gating Note

Frontend wallet connect is a UI capability, not backend authentication.

That means:

- the frontend can show wallet-connected state
- the frontend can gate screens in the browser
- the backend still does not know a trusted user identity

If wallet identity must become a real user session, add:

- backend-issued nonce
- wallet signature request in the frontend
- backend signature verification
- authenticated session creation

See `WALLET_AUTH_FLOW.md` for the complete flow.

## Non-Goals For Initial Frontend Build

- no generic admin-style navigation
- no large settings surface
- no deep player-stat tables
- no betting flows
- no overloaded sidebars

## Implementation Strategy

Phase 1:

- build with mock data only
- lock layout and visual hierarchy
- confirm chart behavior and event rendering

Phase 2:

- connect real fixture list
- connect live stream state
- replace mock emitter with backend events

Phase 3:

- add premium history scrubbing
- add wallet gating
- polish loading, reconnection, and error states
