import asyncio
import httpx
import time
import logging
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("app.cron.fixture_watcher")

WATCHED_COMPETITION_IDS = {
    72
}  # <-- for the world cup competition, if more leagues we add thier ID
LEAD_TIME_SECONDS = 90 * 60  # <-- 90 minutes before kickoff, we start watching
MAX_WATCH_DURATION_SECONDS = (
    3.5 * 60 * 60
)  # <-- 3.5 hours after kickoff, we stop watching
MAIN_APP_URL = settings.MAIN_APP_URL


async def get_with_wake_retry(client, url, **kwargs):
    """First hit to a sleeping Railway service can 502 while it cold-boots."""
    for attempt in range(3):
        resp = await client.get(url, **kwargs)
        if resp.status_code != 502:
            return resp
        await asyncio.sleep(2)
    resp.raise_for_status()
    return resp


async def run_once():
    async with httpx.AsyncClient() as client:
        for comp_id in WATCHED_COMPETITION_IDS:
            logger.info(
                f"cron is awake and now checking if there is any match that fits competition id {comp_id}"
            )

        fx_resp = await client.get(
            f"{settings.TXLINE_BASE_URL}/fixtures/snapshot",
            headers={
                "Authorization": f"Bearer {settings.TXLINE_JWT_TOKEN}",
                "X-Api-Token": settings.TXLINE_API_KEY,
            },
        )
        fixtures = fx_resp.json()

        watched_resp = await get_with_wake_retry(client, f"{MAIN_APP_URL}/streams")
        currently_watching = watched_resp.json()

        now_ms = time.time() * 1000
        started, stopped = 0, 0

        to_start = []
        for fx in fixtures:
            fixture_id = fx.get("FixtureId")
            start_time_ms = fx.get("StartTime")
            competition_id = fx.get("CompetitionId")
            if fixture_id is None or start_time_ms is None:
                continue
            if competition_id not in WATCHED_COMPETITION_IDS:
                continue

            seconds_to_kickoff = (start_time_ms - now_ms) / 1000
            should_be_watching = (
                -MAX_WATCH_DURATION_SECONDS < seconds_to_kickoff < LEAD_TIME_SECONDS
            )
            key = str(fixture_id)

            if should_be_watching and key not in currently_watching:
                to_start.append((fixture_id, start_time_ms))
            elif should_be_watching and key in currently_watching:
                logger.info(
                    f"match {fixture_id} still being watched by annotation service"
                )

        if to_start:
            details = ", ".join(f"{fid} at {sts}" for fid, sts in to_start)
            logger.info(
                f"there are {len(to_start)} matches will start stream of {details}"
            )

        for fixture_id, start_time_ms in to_start:
            logger.info(
                f"opening stream {fixture_id} and connecting them to annotation service"
            )
            resp = await client.post(f"{MAIN_APP_URL}/streams/{fixture_id}")
            if resp.status_code == 200:
                logger.info(
                    f"connected annotation service to SSE for fixture id {fixture_id}"
                )
            else:
                logger.error(
                    f"failed to connect fixture id {fixture_id}: {resp.status_code}"
                )
            started += 1

        for fixture_id_str, duration in currently_watching.items():
            if duration is not None and duration > MAX_WATCH_DURATION_SECONDS:
                logger.info(f"cron: stopping stream for fixture {fixture_id_str}")
                await client.delete(f"{MAIN_APP_URL}/streams/{fixture_id_str}")
                stopped += 1

        still_watching = len(currently_watching) - stopped
        if started == 0 and stopped == 0:
            logger.info(
                f"cron: checked {len(fixtures)} fixtures, no live match in watch window, {still_watching} already streaming"
            )
        else:
            logger.info(
                f"cron: checked {len(fixtures)} fixtures, started {started}, stopped {stopped}, {still_watching + started} now streaming"
            )


if __name__ == "__main__":
    logger.info("cron: run starting")
    asyncio.run(run_once())
    logger.info("cron: run finished")
