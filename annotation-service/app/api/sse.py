import asyncio
import json
import itertools
from collections import defaultdict
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
_event_counter = itertools.count(1)


async def publish(fixture_id: str, event: dict):
    event_id = next(_event_counter)
    payload = json.dumps(event)
    message = (
        f"id: {event_id}\nevent: {event.get('type', 'message')}\ndata: {payload}\n\n"
    )

    dead_queues = []
    for q in _subscribers[fixture_id]:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead_queues.append(q)  # if there is a slow/stuck client, drop it

    for q in dead_queues:
        _subscribers[fixture_id].discard(q)


@router.get("/stream/{fixture_id}")
async def stream(fixture_id: int, request: Request):
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers[fixture_id].add(queue)

    async def event_generator():
        try:
            yield ": connected\n\n"
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
