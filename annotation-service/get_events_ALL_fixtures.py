"""
Standalone historical backfill.

Does NOT touch any live-serving code path. Reuses the exact same
AnnotationService that production uses -- same entity resolution, same
dedup, same readiness gating, same Gemini calls, same Postgres writes.
The only difference from live traffic: events come from TxLine's
historical replay endpoint instead of the live /scores stream.

Run standalone, not as part of the web app:
    python -m scripts.backfill_historical

Safe to re-run: skips any fixture that already has rows in the DB, so
running this twice won't create duplicate annotations.
"""

import asyncio
import httpx
import json

from app.services.annotation_service import AnnotationService
from app.services.history_service import HistoryService
from app.core.config import settings
from app.db.database import engine, Base
from app.db.models import (
    Annotation,
)  # noqa: F401 -- import needed so Base.metadata knows about this table

# Fill in your fixture IDs from the last 2 weeks here
FIXTURE_IDS = [
    17588223,
    17588227,
    17588228,
    17588229,
    17588230,
    17588231,
    17588232,
    17588234,
    17588235,
    17588236,
    17588238,
    17588239,
    17588240,
    17588241,
    17588242,
    17588244,
    17588245,
    17588302,
    17588303,
    17588305,
    17588306,
    17588308,
    17588309,
    17588310,
    17588311,
    17588313,
    17588314,
    17588316,
    17588317,
    17588318,
    17588319,
    17588320,
    17588321,
    17588322,
    17588323,
    17588324,
    17588325,
    17588326,
    17588386,
    17588388,
    17588389,
    17588390,
    17588391,
    17588394,
    17588395,
    17588396,
    17588397,
    17588398,
    17588399,
    17588400,
    17588401,
    17588402,
    17588403,
    17588404,
    17588405,
    17588406,
    17926553,
    17926593,
    17926603,
    17926604,
    17926615,
    17926647,
    17926686,
    17926687,
    17926688,
    17926689,
    17926696,
    17926703,
    17926704,
    17926740,
    17926764,
    17926765,
    17926766,
    17926828,
    18167317,
    18172280,
    18172379,
    18172469,
    18175397,
    18175918,
    18175981,
    18175983,
    18176123,
    18179549,
    18179550,
    18179551,
    18179552,
    18179759,
    18179763,
    18179764,
    18185036,
    18187298,
    18188721,
    18192996,
    18198205,
    18202783,
    18209181,
    18213979,
    18222446,
    18241006,
]

HISTORICAL_URL = "https://txline.txodds.com/api/scores/historical/{fixture_id}"

# IMPORTANT: copy the EXACT header construction TxLineClient uses for
# live auth (Authorization/API key headers) -- don't guess this, pull it
# straight from txline_client.py's __init__ so backfill auth matches
# live auth exactly.
HEADERS = {
    "Authorization": f"Bearer {"eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3ODU2NjYyNjcsInNlc3Npb25JZCI6ImE2YWYxM2Y1LWYzMzctNDIyNS1hMDJmLTMwYWI1ZTQ0NGFmMCIsInJvbGUiOiJndWVzdCIsIm1heWJlQ2xpZW50SXAiOiI1Mi40Ni4xOS43NiJ9.u-2vXN_I6-XV9EYZWOTNKTRdoGf3PgNfpGButO-8QTIXekh_LDdm_ZhVlyfqvl1hDvlCNWZTENDTaOWpsrW45g"}",
    "X-Api-Token": "txoracle_api_d3ead620b3b249c48b8a55648bbd6e52",
}


async def backfill_fixture(
    client: httpx.AsyncClient,
    svc: AnnotationService,
    history: HistoryService,
    fixture_id: int,
):
    # idempotency guard -- skip if this fixture already has data
    existing = await history.history(fixture_id)
    if existing:
        print(f"[{fixture_id}] already has {len(existing)} rows, skipping")
        return

    url = HISTORICAL_URL.format(fixture_id=fixture_id)
    resp = await client.get(url, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    # historical endpoint returns SSE framing ("data: {...}" per line),
    # not a plain JSON array -- parse it the same way a live SSE consumer
    # would, just against a response body we already have in full rather
    # than an open connection.
    events = []
    for line in resp.text.splitlines():
        line = line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[len("data:") :].strip()
        if not payload:
            continue
        try:
            events.append(json.loads(payload))
        except json.JSONDecodeError:
            continue  # skip any malformed/non-JSON line rather than dying
    events.sort(key=lambda e: e.get("Seq", 0))

    print(f"[{fixture_id}] replaying {len(events)} messages...")
    for event in events:
        await svc.process_event(event)
        if event.get("Action") == "game_finalised":
            break  # match is over, no point processing anything after

    final = await history.history(fixture_id)
    print(f"[{fixture_id}] done -- {len(final)} rows persisted")


async def main():
    # mirrors main.py's startup step -- this script never starts the actual
    # app, so that hook never fires here. Safe to call every run: create_all
    # only creates tables that don't exist yet, never touches existing ones.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    svc = AnnotationService()  # ONE shared instance across all
    history = HistoryService()  # fixtures -- safe, everything's
    # keyed by FixtureId internally
    async with httpx.AsyncClient() as client:
        for fixture_id in FIXTURE_IDS:
            try:
                await backfill_fixture(client, svc, history, fixture_id)
            except Exception as e:
                print(f"[{fixture_id}] FAILED: {e}")
                continue  # don't let one bad fixture kill the whole run


if __name__ == "__main__":
    asyncio.run(main())
