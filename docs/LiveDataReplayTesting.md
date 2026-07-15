# Live Data Replay Testing Plan

## Purpose

We need a fake live match workflow that lets us open the match screen and watch the chart, score, phase, and match events update as if the backend were feeding live data.

The first test source is:

```text
C:\Users\ajogu\Documents\pitchline\test\match-data.txt
```

This file represents the shape of data we expect to receive for a match replay:

- `fixtureId`
- `homeName`
- `awayName`
- `oddsHistory`
- `events`

For this phase, the focus is the live probability chart and basic match events. Commentary and annotations are out of scope.

## Scope Rules

- Do not touch the real backend implementation during this phase.
- Any frontend implementation should stay inside `client/`.
- If backend-like test tooling is needed, create a separate `backend-test/` folder.
- Do not inject synthetic events yet. We will add half-time, breaks, pauses, and other structural events later.
- Use the existing sample data as-is before adding extra generated scenarios.

## Current System Notes

The client live match screen listens for two live event types:

- `OddsUpdate`: updates chart probabilities and market analytics.
- `ScoreUpdate`: updates score, minute, phase, and basic match state.

The normal app route is:

```text
/match/{fixtureId}
```

For the sample file, the target fixture is:

```text
/match/fake-live-match-001
```

The important issue is that the existing real backend replay endpoint expects raw TxLine-style events, while `test/match-data.txt` is already aggregated match data. So the test harness should understand this file directly instead of trying to force it through the existing backend replay service.

## Recommended First Implementation

Build a client-side live replay mode inside `client/`.

The simplest version should:

1. Load `test/match-data.txt` or a copied/public equivalent available to the client.
2. Create an initial live match state from the first odds point.
3. Replay `oddsHistory` one point at a time.
4. Replay only the events already present in the file.
5. Update the same chart and match UI paths used by the live match screen.
6. Add replay controls for starting, pausing, resuming, and changing speed.

This keeps the test loop fast and avoids changing backend behavior.

## Data Mapping

### Odds Points

Each item in `oddsHistory` should become a chart point:

```json
{
  "timestamp": "2026-07-09T20:02:59.316+00:00",
  "homePct": 59.6,
  "drawPct": 24.6,
  "awayPct": 15.8
}
```

Client state equivalent:

```json
{
  "timestamp": "...",
  "teamA": 59.6,
  "draw": 24.6,
  "teamB": 15.8
}
```

### Match Events

Each item in `events` should become a basic match event:

```json
{
  "eventType": "goal",
  "homeScore": 1,
  "awayScore": 0,
  "minute": "59",
  "phase": "2nd Half",
  "timestamp": "2026-07-09T21:23:47.774+00:00"
}
```

For now, only render events that already exist in the file. Do not add synthetic half-time, break, or full-time events yet.

## Replay Behavior

The replay should merge odds points and match events into a single timeline sorted by timestamp.

Recommended controls:

- Start replay
- Pause replay
- Resume replay
- Restart replay
- Speed selector

Recommended speed options:

- `1x`
- `5x`
- `10x`
- `30x`
- fixed interval mode, such as one update every `1000ms`

For debugging chart behavior, fixed interval mode is likely the easiest to read.

## Testing Checklist

Use this checklist when the first replay mode exists:

- The match opens using fixture `fake-live-match-001`.
- The chart starts with the first probability point.
- New odds points append without replacing the whole chart incorrectly.
- The latest probability values update as the replay progresses.
- Goal events appear when their timestamps are reached.
- Score updates match the event data.
- Phase and minute labels update from the event data.
- The chart remains readable as more points arrive.
- Tooltip and hover behavior still work while data is updating.
- Pause and resume do not duplicate points.
- Restart clears replay state before starting again.

## Later Phase

After the basic replay works, add controlled synthetic scenarios:

- Kickoff
- Half-time
- Second-half start
- Break or interruption
- Market freeze
- Full-time
- Goal correction or duplicated goal event
- Red card
- Penalty event

These should be added only after the base file replay is stable.

