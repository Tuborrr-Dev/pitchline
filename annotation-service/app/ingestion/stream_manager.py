"""StreamManager
                     │
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
Fixture A       Fixture B      Fixture C
      │              │              │
      ▼              ▼              ▼
 TxLineClient   TxLineClient   TxLineClient"""

import asyncio
from app.ingestion.txline_client import TxLineClient
import logging

logger = logging.getLogger(__name__)


class StreamManager:

    def __init__(self, annotation_service):
        self.client = TxLineClient(on_event=annotation_service.process_event)
        self.tasks = {}  # <-- storing the matches as we open them

    # this checks if we are already watching the match before starting the stream
    async def start_stream(self, fixture_id: int):
        if fixture_id in self.tasks:
            return
        task = asyncio.create_task(self.client.consume_scores(fixture_id))
        task.add_done_callback(lambda t: self._on_stream_done(fixture_id, t))
        self.tasks[fixture_id] = (
            task  # <-- store the task in the dictionary with fixture_id as key
        )

    def _on_stream_done(self, fixture_id: int, task: asyncio.Task):
        self.tasks.pop(fixture_id, None)
        if task.cancelled():
            return
        exc = task.exception()
        if exc is not None:
            logging.getLogger(__name__).error(
                "Stream for fixture %s died unexpectedly: %s", fixture_id, exc
            )

    # this stops the stream for a specific fixture and removes it from the tasks dictionary
    async def stop_stream(self, fixture_id: int):
        task = self.tasks.get(fixture_id)
        if task is None:
            return
        task.cancel()
        del self.tasks[
            fixture_id
        ]  # <-- remove the task from the dictionary after stopping it with fixture_id as key
