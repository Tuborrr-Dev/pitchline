import asyncio
import json
import itertools
from collections import defaultdict
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.clock_anchor_service import get_anchors
from app.db.database import AsyncSessionLocal

router = APIRouter()

_subscribers: dict[int, set[asyncio.Queue]] = defaultdict(set)
_event_counter = itertools.count(1)


def _format(event: dict) -> str:
    event_id = next(_event_counter)
    payload = json.dumps(event)
    return f"id: {event_id}\nevent: {event.get('type', 'message')}\ndata: {payload}\n\n"


async def publish(fixture_id: int, event: dict):
    message = _format(event)
    dead_queues = []
    for q in _subscribers[fixture_id]:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead_queues.append(q)
    for q in dead_queues:
        _subscribers[fixture_id].discard(q)


@router.get("/stream/{fixture_id}")
async def stream(fixture_id: int, request: Request):
    from app.services.history_service import HistoryService

    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers[fixture_id].add(queue)

    async def event_generator():
        try:
            yield ": connected\n\n"
            history_service = HistoryService()
            rows = await history_service.history(fixture_id)
            for row in rows:
                yield _format(
                    {
                        "type": row.annotation_type,
                        "action": row.action,
                        "team": row.team,
                        "player": row.player,
                        "minute": row.minute,
                        "phase": row.phase,
                        "home_score": row.home_score,
                        "away_score": row.away_score,
                        "icon": row.icon,
                        "color": row.color,
                        "text": row.text,
                        "outcome": row.outcome,
                        "fixture_id": row.fixture_id,
                        "source_action": row.source_action,
                        "source_id": row.source_id,
                    }
                )
            async with AsyncSessionLocal() as session:
                anchors = await get_anchors(session, fixture_id)
            for a in anchors:
                yield _format(
                    {
                        "type": "clock_anchor",
                        "phase": a.phase,
                        "status_id": a.status_id,
                        "utc_start": a.utc_start.isoformat(),
                        "minute_start": a.minute_start,
                        "seconds_start": a.seconds_start,
                        "running": a.running,
                    }
                )

            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15)
                    yield message
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            _subscribers[fixture_id].discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
