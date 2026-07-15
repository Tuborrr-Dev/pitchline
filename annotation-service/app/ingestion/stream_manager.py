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

logger = logging.getLogger(__name__)


class StreamManager:
    def __init__(self, annotation_service):
        self.client = TxLineClient(on_event=annotation_service.process_event)
        self.annotation_service = annotation_service
        self.tasks = {}
        self.watch_started_at = (
            {}
        )  # fixture_id -> monotonic() timestamp, for duration-based stop
        self.finished_fixtures: set[int] = set()

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

    async def restore_lineups(self, fixture_id: int) -> None:
        data = await self.lineup_store.load(fixture_id)
        if data is None:
            return
        team_names, player_names = data
        self.entity_resolver.import_lineups(team_names, player_names)

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
