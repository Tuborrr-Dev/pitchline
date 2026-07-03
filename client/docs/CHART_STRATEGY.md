# Chart Strategy

## Why The Chart Matters

For PITCHLINE, the chart is not decorative. It is the main product surface.

Users should be able to understand:

- current win probability
- direction of momentum
- timing of shifts
- event causality

The chart must therefore support both:

- live updates
- narrative annotation

## Recommended Library

Primary recommendation:

- `lightweight-charts`

Why:

- designed for financial-style charting
- closely matches the intended terminal metaphor
- supports multiple series
- supports real-time updates
- supports series markers for event annotations
- has current React integration guidance

Important caveat:

- the library requires TradingView attribution/notice in the product

## Fallback Options

### Recharts

Use if:

- the team wants faster React-native ergonomics
- a simpler line-chart integration is more important than terminal-grade chart feel

Tradeoff:

- easier to move quickly
- less convincing as a market-terminal chart

### visx

Use if:

- the team wants maximum control
- the team is willing to build more chart behavior manually

Tradeoff:

- most flexible
- highest implementation cost

### ECharts

Use if:

- the team wants a very capable charting engine with broad features

Tradeoff:

- excellent charting system
- less naturally aligned with the TradingView/terminal visual target

## Decision

Current recommendation:

1. use `lightweight-charts`
2. only switch if attribution or integration complexity becomes a blocker

## Required Chart Features

The chart implementation must support the following.

### MVP Chart Features

- three simultaneous line series
- Team A line
- Draw line
- Team B line
- live updates without full rerender
- event markers at exact timestamps
- visible crosshair or point inspection
- responsive resizing
- initial data hydration from snapshot or mock history

### UX Features

- custom legend outside the chart canvas
- selected point readout
- smooth visual updates
- reconnect overlay without clearing state
- chart focus sync with timeline selection

### Future Features

- history scrubbing
- replay mode
- comparison or alternate match view if premium expands later

## Visual Rules

- Team A is always green
- Team B is always red
- Draw is always muted gray
- line colors do not swap based on home/away
- dark chart canvas
- restrained gridlines
- no bright rainbow palettes

## Marker Rules

Each event marker needs:

- timestamp mapping
- event icon or shape
- short visible label
- detailed label on hover or tap

Marker priorities:

- goals and red cards should read strongest
- yellow cards should read subtly
- VAR should look uncertain or paused
- HT and FT should feel structural, not dramatic

## Data Binding Strategy

The chart should read from a frontend-owned history array of probability points.

The UI should not depend directly on backend transport details.

Good separation:

- data source layer produces `ProbabilityPoint[]`
- chart component consumes normalized points

This lets the same chart work with:

- mock event generators
- REST snapshot data
- SignalR or SSE live updates
- replayed historical data

## Integration Guidance

The chart should be wrapped in a dedicated component boundary.

Recommended split:

- `ProbabilityChart`
- `useProbabilitySeries`
- `useChartSelection`
- `useTimelineSync`

Even if the implementation starts simpler, those are the concerns to preserve.

## Risks

### Risk: Over-building custom chart UI too early

Mitigation:

- start with library-native behavior
- layer custom readout and timeline sync after the base chart is stable

### Risk: Marker clutter on mobile

Mitigation:

- prioritize major event types
- collapse low-importance labels
- move detail into the timeline and readout

### Risk: Real-time update jank

Mitigation:

- append or update single points
- avoid full dataset resets on every event

### Risk: Library mismatch

Mitigation:

- do a short spike early
- validate multiple series, markers, resize, and live updates before deeper buildout
