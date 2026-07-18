"""StreamManager
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
Fixture A       Fixture B      Fixture C
      │              │              │
      ▼              ▼              ▼
 TxLineClient   TxLineClient   TxLineClient"""

import asyncio
import time
from app.ingestion.txline_client import TxLineClient
import logging
from datetime import datetime, timezone
from app.services.clock_anchor_service import LiveAnchorTracker, save_anchor
from app.db.database import AsyncSessionLocal
from app.api.sse import publish

logger = logging.getLogger(__name__)


class StreamManager:
    def __init__(self, annotation_service):
        self.annotation_service = annotation_service
        self.anchor_trackers: dict[int, LiveAnchorTracker] = {}
        self.client = TxLineClient(on_event=self._on_event)
        self.tasks = {}
        self.watch_started_at = {}
        self.finished_fixtures: set[int] = set()

    async def _on_event(self, event: dict):
        await self.annotation_service.process_event(event)

        fixture_id = event.get("FixtureId")
        if fixture_id is None:
            return
        tracker = self.anchor_trackers.setdefault(
            fixture_id, LiveAnchorTracker(fixture_id)
        )
        anchor = tracker.process_event(event)
        if anchor:
            async with AsyncSessionLocal() as session:
                await save_anchor(session, anchor)
            await publish(
                fixture_id,
                {
                    "type": "clock_anchor",
                    "phase": anchor["phase"],
                    "status_id": anchor["status_id"],
                    "utc_start": anchor[
                        "utc_start"
                    ].isoformat(),  # datetime -> str, json.dumps can't serialize datetime directly
                    "minute_start": anchor["minute_start"],
                    "seconds_start": anchor["seconds_start"],
                    "running": anchor["running"],
                },
            )

    async def start_stream(self, fixture_id: int):
        if fixture_id in self.tasks:
            return
        if fixture_id in self.finished_fixtures:
            return
        await self.annotation_service.restore_lineups(fixture_id)
        task = asyncio.create_task(self.client.consume_scores(fixture_id))
        task.add_done_callback(lambda t: self._on_stream_done(fixture_id, t))
        self.tasks[fixture_id] = task
        self.watch_started_at[fixture_id] = time.monotonic()

        started_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        logger.info(
            f"stream now open for fixture {fixture_id}, started at {started_at}"
        )

    def _on_stream_done(self, fixture_id: int, task: asyncio.Task):
        self.tasks.pop(fixture_id, None)
        self.watch_started_at.pop(fixture_id, None)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logging.getLogger(__name__).error(
                "Stream for fixture %s died unexpectedly: %s", fixture_id, exc
            )
        else:
            self.finished_fixtures.add(fixture_id)

    async def stop_stream(self, fixture_id: int):
        task = self.tasks.get(fixture_id)
        if task is None:
            return
        task.cancel()
        del self.tasks[fixture_id]
        self.watch_started_at.pop(fixture_id, None)

    def is_watching(self, fixture_id: int) -> bool:
        return fixture_id in self.tasks

    def watch_duration_seconds(self, fixture_id: int) -> float | None:
        started = self.watch_started_at.get(fixture_id)
        return None if started is None else time.monotonic() - started
