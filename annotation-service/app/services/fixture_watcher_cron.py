import asyncio
import httpx
import time
from app.core.config import settings

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
        fx_resp = await client.get(
            f"{settings.TXLINE_BASE_URL}/fixtures/snapshot",
            headers={
                "Authorization": f"Bearer {settings.TXLINE_JWT_TOKEN}",
                "X-Api-Token": settings.TXLINE_API_KEY,
            },
        )
        fixtures = fx_resp.json()

        watched_resp = await client.get(f"{MAIN_APP_URL}/streams")
        currently_watching = watched_resp.json()  # {fixture_id: duration_seconds}

        now_ms = time.time() * 1000

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
                print(f"starting stream for fixture {fixture_id}")
                await client.post(f"{MAIN_APP_URL}/streams/{fixture_id}")

            if (
                key in currently_watching
                and currently_watching[key] > MAX_WATCH_DURATION_SECONDS
            ):
                print(f"stopping stream for fixture {fixture_id}")
                await client.delete(f"{MAIN_APP_URL}/streams/{fixture_id}")


if __name__ == "__main__":
    asyncio.run(run_once())
