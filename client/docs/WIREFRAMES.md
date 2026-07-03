# Wireframes

This document describes the intended structure of the frontend before high-fidelity UI work begins.

## 1. Match Lobby

### Desktop

Order from top to bottom:

1. `HeroBar`
2. `LiveNowSection`
3. `UpcomingSection`
4. `FooterInfo`

### HeroBar

Content:

- PITCHLINE wordmark
- one-line positioning statement
- connection badge
- wallet button

Behavior:

- compact, not oversized
- should establish the market-terminal tone immediately

### LiveNowSection

Purpose:

- first thing users see
- should prioritize active fixtures

Layout:

- stacked or two-column list depending on viewport width
- cards should remain dense and scannable

Each card should show:

- team A code/name
- team B code/name
- score
- phase or minute
- live status chip
- current lead probability
- mini sparkline

### UpcomingSection

Purpose:

- show what is next without competing with live matches

Each card should show:

- teams
- kickoff time in local time
- competition/stage
- upcoming status chip
- optional neutral mini chart placeholder

### Mobile

Rules:

- hero compresses into a tighter top band
- cards become one-column only
- sparkline stays visible but compact
- score and probability remain larger than supporting metadata

## 2. Live Match View

### Desktop Layout

Order from top to bottom:

1. `TopBar`
2. `MatchHeader`
3. `ProbabilityTicker`
4. `ProbabilityChart`
5. `EventTimelineStrip`
6. `NarrativePanel`
7. `SystemStatusBar`

### TopBar

Content:

- logo
- back to lobby
- connection badge
- wallet button

Rules:

- thin and utility-focused
- should not steal space from the chart

### MatchHeader

Content:

- Team A
- score
- Team B
- live clock
- phase
- current probabilities

Desktop emphasis:

- score and current probabilities are the main readouts
- phase and competition are secondary

### ProbabilityTicker

Content:

- latest directional move
- minute
- short cause label

Examples:

- `ARG +8.3% 47' Goal`
- `Draw -3.1% 82' Red card`

Behavior:

- flashes on update
- should feel like a market tape, not a verbose explanation block

### ProbabilityChart

This is the dominant block on the page.

Must include:

- three probability lines
- x-axis tied to match time
- markers at event timestamps
- hover or tap inspection
- custom legend
- selected point readout

Overlays:

- initial loading
- reconnecting
- stale feed

### EventTimelineStrip

Purpose:

- provide a quick scan of major events
- give users a tap target to jump to a chart point

Behavior:

- horizontal scroll
- active state when event is selected
- distinct chip treatment per event type

### NarrativePanel

Purpose:

- show premium, high-significance moments

Behavior:

- appears after a major event
- visually separate from deterministic event labels
- dismissible
- on mobile it may collapse into a smaller bottom card

### SystemStatusBar

Content:

- live or reconnecting
- last update time
- data source note if needed

## 3. Mobile Match View

At 375px width, the layout should behave like this:

### Order

1. `TopBar`
2. `MatchHeader`
3. `ProbabilityTicker`
4. `ProbabilityChart`
5. `ChartReadout`
6. `EventTimelineStrip`
7. `NarrativePanel`
8. `SystemStatusBar`

### Mobile Rules

- the chart remains the largest block
- the header stacks vertically
- probabilities remain highly visible
- timeline becomes swipe-first
- chart tooltip content may move into a fixed readout below the chart
- narrative panel should not cover core controls for long

## 4. Visual Hierarchy Rules

Strongest emphasis:

- score
- current probabilities
- chart movement

Medium emphasis:

- ticker move
- event markers
- narrative moment

Lower emphasis:

- competition label
- stage
- source metadata
- wallet state when disconnected

## 5. Empty And Error States

### Lobby Empty State

- no live matches available
- show upcoming fixtures prominently
- explain that live matches appear here automatically

### Match Empty State

- if no history yet, show match shell and loading chart
- avoid blank pages

### Reconnect State

- keep last chart visible
- show clear reconnect badge
- avoid resetting user context

### Hard Failure

- branded message
- retry action
- never expose raw error text in the main UI
