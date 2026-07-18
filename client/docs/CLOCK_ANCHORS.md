# Clock Anchors FE Contract

## Problem

Odds history arrives with real UTC timestamps, while the chart aligns data by match minute. A simple `(timestamp - kickoff) / 60` conversion drifts after halftime and stoppages because real time continues while the match clock is paused.

Annotation markers are not part of this conversion. They already carry correct match minutes from the annotation service.

## Backend Contract

Fetch anchors once when opening a fixture:

```http
GET /fixtures/{fixture_id}/clock-anchors
```

Expected response:

```json
[
  {
    "phase": "1H",
    "status_id": 2,
    "utc_start": "2026-07-15T19:00:00Z",
    "minute_start": 0,
    "seconds_start": 0,
    "running": true
  },
  {
    "phase": "HT",
    "status_id": 3,
    "utc_start": "2026-07-15T19:45:03Z",
    "minute_start": 45,
    "seconds_start": 2700,
    "running": false
  },
  {
    "phase": "2H",
    "status_id": 4,
    "utc_start": "2026-07-15T20:00:12Z",
    "minute_start": 45,
    "seconds_start": 2700,
    "running": true
  }
]
```

Live fixtures can also emit anchors through the annotation SSE stream:

```json
{
  "type": "clock_anchor",
  "data": {
    "phase": "2H",
    "status_id": 4,
    "utc_start": "2026-07-15T20:00:12Z",
    "minute_start": 45,
    "seconds_start": 2700,
    "running": true
  }
}
```

## Frontend Rules

For each odds timestamp:

1. Sort anchors by `utc_start`.
2. Find the latest anchor where `utc_start <= odds.timestamp`.
3. If no anchor exists, return no converted minute.
4. If the anchor is not running, pin the odds point to `minute_start`.
5. If the anchor is running, use `minute_start + elapsedSeconds / 60`.

Fallback order for odds points:

1. Convert `timestamp` with clock anchors when anchors are available.
2. Else use a backend-provided odds `minute` when present.
3. Else use the old kickoff fallback only when anchors and odds minute are missing.

Backend odds `minute` can represent real elapsed feed time on some fixtures, so it must not override a valid anchor conversion.

## Phases

Common phase values:

| Phase | Status ID | Running | Meaning |
| --- | ---: | --- | --- |
| `1H` | 2 | true | First half |
| `HT` | 3 | false | Halftime |
| `2H` | 4 | true | Second half |
| `FT` | 5 | false | Full time |
| `BREAK_PRE_ET` | 6 | false | Break before extra time |
| `ET1` | 7 | true | Extra time first half |
| `BREAK_ET` | 8 | false | Break between extra-time halves |
| `ET2` | 9 | true | Extra time second half |
| `PENS` | 10 | false | Penalty shootout |
| `FINAL` | 100 | false | Match over |

Normal matches usually only produce `1H`, `HT`, `2H`, and `FT` or `FINAL`.
