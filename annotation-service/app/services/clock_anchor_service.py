import logging
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import ClockAnchor

logger = logging.getLogger(__name__)

STATUS_PHASE_MAP = {
    1: "PRE",
    2: "1H",
    3: "HT",
    4: "2H",
    5: "FT",
    6: "BREAK_PRE_ET",
    7: "ET1",
    8: "BREAK_ET",
    9: "ET2",
    10: "PENS",
    100: "FINAL",
}
SKIP_STATUS_IDS = {1}


class LiveAnchorTracker:
    """One instance per fixture. Feed it every event; it tells you when a
    new anchor exists so you can persist + broadcast it."""

    def __init__(self, fixture_id: int):
        self.fixture_id = fixture_id
        self._seen_status_ids: set[int] = set()
        self._last_running_seconds = 0

    def process_event(self, event: dict) -> dict | None:
        clock = event.get("Clock") or {}
        seconds = clock.get("Seconds")
        running = clock.get("Running")

        if running is True and seconds:
            self._last_running_seconds = seconds

        if event.get("Action") == "game_finalised" and 100 not in self._seen_status_ids:
            self._seen_status_ids.add(100)
            return self._build(100, event["Ts"], self._last_running_seconds, False)

        if event.get("Action") != "clock_adjustment":
            return None

        status_id = event.get("StatusId")
        if (
            status_id is None
            or status_id in SKIP_STATUS_IDS
            or status_id in self._seen_status_ids
        ):
            return None
        if seconds is None:
            return None

        self._seen_status_ids.add(status_id)
        effective_seconds = seconds if seconds > 0 else self._last_running_seconds
        return self._build(status_id, event["Ts"], effective_seconds, bool(running))

    def _build(
        self, status_id: int, ts_millis: int, seconds: int, running: bool
    ) -> dict:
        return {
            "fixture_id": self.fixture_id,
            "phase": STATUS_PHASE_MAP.get(status_id, f"UNKNOWN_{status_id}"),
            "status_id": status_id,
            "utc_start": datetime.fromtimestamp(ts_millis / 1000, tz=timezone.utc),
            "minute_start": seconds // 60,
            "seconds_start": seconds,
            "running": running,
        }


def extract_anchors_from_events(fixture_id: int, events: list[dict]) -> list[dict]:
    """Batch version for backfill -- same rule, run over a full event list at once."""
    tracker = LiveAnchorTracker(fixture_id)
    anchors = []
    for event in events:
        anchor = tracker.process_event(event)
        if anchor:
            anchors.append(anchor)
    return anchors


async def save_anchor(session: AsyncSession, anchor: dict) -> None:
    stmt = pg_insert(ClockAnchor).values(**anchor)
    stmt = stmt.on_conflict_do_update(
        index_elements=["fixture_id", "status_id"],
        set_={
            "phase": stmt.excluded.phase,
            "utc_start": stmt.excluded.utc_start,
            "minute_start": stmt.excluded.minute_start,
            "seconds_start": stmt.excluded.seconds_start,
            "running": stmt.excluded.running,
        },
    )
    await session.execute(stmt)
    await session.commit()


async def get_anchors(session: AsyncSession, fixture_id: int) -> list[ClockAnchor]:
    result = await session.execute(
        select(ClockAnchor)
        .where(ClockAnchor.fixture_id == fixture_id)
        .order_by(ClockAnchor.status_id)
    )
    return list(result.scalars().all())
