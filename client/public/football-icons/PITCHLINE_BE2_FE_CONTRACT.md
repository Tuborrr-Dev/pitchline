# Pitchline BE2 — Frontend Contract (v2)

Rebuilt against the actual current codebase — every payload example below
was captured by running the real `entity_resolver.py` / `rule_engine.py` /
`annotation_service.py` / `commentary_service.py` / `ai.py` /
`history_service.py` through two real matches, not reconstructed by
reading code. The one exception is `retract`, marked below, since neither
test match happened to fire one live.

---

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/` | `{"status": "running"}` — health check |
| POST | `/streams/{fixture_id}` | `{"status": "watching", "fixture_id": ...}` |
| DELETE | `/streams/{fixture_id}` | `{"status": "stopped", "fixture_id": ...}` |
| GET | `/history/{fixture_id}` | array of annotation rows (below) |
| GET | `/stream/{fixture_id}` | SSE — live tail |

**Known behavior, not a bug:** `POST`/`DELETE /streams/{fixture_id}`
always return 200 with that status string, even if nothing actually
changed — e.g. calling stop on a fixture that was never started just
no-ops and still says `"stopped"`. Don't treat the response as
confirmation that a stream was genuinely running/stopped, just that the
request was accepted.

**`GET /history/{fixture_id}` for a fixture with no data** returns `[]`,
not a 404.

---

## GET /history/{fixture_id}

```json
{
  "id": 42,
  "fixture_id": 18209181,
  "source_action": "goal",
  "source_id": 683,
  "type": "annotation",
  "action": "goal",
  "team": "France",
  "player": "Mbappe Lottin, Kylian",
  "minute": 59,
  "phase": "H2",
  "home_score": 1,
  "away_score": 0,
  "icon": "soccer_ball",
  "color": "gold",
  "text": "...",
  "outcome": null
}
```

Ordered by `(minute, id)`. Same shape as SSE messages minus `score` and
`reason`, which only exist on the SSE `annotation` payload, not the
persisted row — those two are informational for logging, not part of what
gets shown.

---

## GET /stream/{fixture_id} (SSE)

```
id: 87
event: <type>
data: {...}
```

Four possible `type` values.

### `commentary` — RULE tier, no AI involved
Real captured example:
```json
{
  "type": "commentary",
  "action": "status",
  "team": null,
  "player": null,
  "minute": 0,
  "phase": "H1",
  "home_score": 0,
  "away_score": 0,
  "icon": "clock",
  "color": "gray",
  "text": "Period change (StatusId 2)",
  "fixture_id": 18209181,
  "source_action": "status",
  "source_id": 27,
  "source_seconds": 0,
  "outcome": null
}
```
`icon` comes from a fixed action→icon map. `color` is side-based:
`"green"` for the home team, `"red"` for away, `"gray"` when there's no
team (period changes, kickoff, etc).

### `annotation` — AI tier, Gemini-written
Real captured example:
```json
{
  "type": "annotation",
  "action": "penalty",
  "minute": 24,
  "team": "France",
  "player": null,
  "score": 18,
  "reason": "Penalty awarded",
  "icon": "",
  "color": "gold",
  "text": "...",
  "phase": "H1",
  "home_score": 0,
  "away_score": 0,
  "fixture_id": 18209181,
  "source_action": "penalty",
  "source_id": 296,
  "source_seconds": 1472,
  "outcome": null
}
```
`color` is always `"gold"` for this tier, regardless of team — don't
apply home/away coloring logic here, only on `commentary` rows.
**`icon` can be an empty string** (confirmed: penalty-awarded rows get
`icon: ""`, not null, not a real icon name) — render defensively, don't
assume every annotation has a usable icon.
`player` can legitimately be `null` here even for a real event (a penalty
*award* doesn't know the taker yet — that's not a bug, just what the data
looks like at that stage).

### `update` — an already-shown event's full annotation changed
Real captured example (a shot originally shown as generic, later
corrected once TxOdds sent an outcome amendment):
```json
{
  "type": "update",
  "action": "shot",
  "team": "France",
  "player": null,
  "minute": 3,
  "phase": "H1",
  "home_score": 0,
  "away_score": 0,
  "icon": "target",
  "color": "green",
  "text": "France Shot Attempt — (off target)",
  "fixture_id": 18209181,
  "source_action": "shot",
  "source_id": 63,
  "source_seconds": 215,
  "outcome": "OffTarget"
}
```
This carries the **full row shape**, same fields as `commentary`/
`annotation` — not a partial patch. FE should find the existing item
matching `(source_action, source_id)` and replace it wholesale with this
payload, not merge fields in.

### `retract` — an already-shown event turned out to be false, remove it
**Not captured live** in either test match (both test matches' discards
all targeted things that were never shown in the first place, so nothing
fired) — this shape is confirmed by reading `history_service.py`
directly, not from a live example:
```json
{
  "type": "retract",
  "fixture_id": 18209181,
  "source_action": "goal",
  "source_id": 495
}
```
FE must remove whatever it rendered for `(source_action, source_id)` —
this has happened for real in match data before (a goal announced then
discarded a message later, never actually scored), just not in either of
the two runs used to build this doc.

---

## Reliability notes

- **Confirmation delay varies a lot by action type.** Most events resolve
  in low single-digit seconds. Goals can take 60-100+ seconds from
  "it happened" to "confirmed with scorer name." BE1's score push covers
  that gap — BE2 intentionally waits rather than showing an incomplete
  "GOAL!" with no name attached.
- **Historical and live use the same row shape**, so one renderer works
  for both `GET /history` and the SSE stream.
- **Single BE2 instance only** — the SSE broadcaster is in-memory,
  per-process. Doesn't affect payload shapes, only matters if BE2 is ever
  scaled to multiple instances.
