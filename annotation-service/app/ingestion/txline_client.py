import asyncio
import logging

import httpx
from httpx_sse import aconnect_sse

from app.core.config import settings

logger = logging.getLogger(__name__)


class TxLineClient:
    def __init__(self, on_event):
        self.on_event = on_event  # async callable(event: dict) -> None
        self.client = httpx.AsyncClient(
            timeout=None,
            headers={
                "Authorization": f"Bearer {settings.TXLINE_JWT_TOKEN}",
                "X-Api-Token": settings.TXLINE_API_KEY,
            },
        )

    async def consume_scores(self, fixture_id: int):
        base_url = f"{settings.TXLINE_BASE_URL}/scores/stream?fixtureId={fixture_id}"
        last_ts = None  # tracks the latest Ts seen so a reconnect can resume instead of missing a gap
        while True:
            url = f"{base_url}&Ts={last_ts}" if last_ts is not None else base_url
            try:
                logger.info(f"Connecting to {url}")
                async with aconnect_sse(self.client, "GET", url) as event_source:
                    event_source.response.raise_for_status()

                    async for sse in event_source.aiter_sse():
                        if sse.event == "heartbeat":
                            continue
                        try:
                            event = sse.json()
                        except Exception:
                            logger.warning(f"Invalid JSON payload: {sse.data}")
                            continue
                        ts = event.get("Ts")
                        if ts is not None:
                            last_ts = ts
                        try:
                            await self.on_event(event)
                        except Exception:
                            logger.exception(
                                "process_event failed for event: %s", event
                            )
                            continue
            except Exception as ex:
                logger.exception(ex)
                logger.info("Reconnecting in 5 seconds...")
                await asyncio.sleep(5)
