"""
build_clock_anchors.py

One-time (or re-run-as-needed) backfill of clock_anchors for historic
fixtures. Reuses TxLineClient exactly as-is -- no new fetch logic. Since
consume_scores() always starts at Ts=0 and returns as soon as it hits
game_finalised, calling it against an already-finished fixture just replays
the whole match and exits naturally.

fixture_kickoffs.json is only used here as the list of fixture IDs to loop
over -- the actual anchor timestamps come from the real Ts values in the
replayed events, not from this file.

Usage:
    railway run python build_clock_anchors.py --fixture-id 18175918          # dry run
    railway run python build_clock_anchors.py --fixture-id 18175918 --write
    railway run python build_clock_anchors.py --all --write                  # every fixture in fixture_kickoffs.json
"""

"""
build_clock_anchors.py
...
"""

import argparse
import asyncio
import json
from datetime import datetime, timedelta, date

import httpx

from app.db.database import AsyncSessionLocal
from app.core.config import settings
from app.services.clock_anchor_service import (
    extract_anchors_from_events,
    save_anchor,
    get_anchors,
)

BASE_URL = (
    "https://txline.txodds.com/api/scores/updates/{epochDay}/{hourOfDay}/{interval}"
)
HEADERS = {
    "Authorization": f"Bearer {settings.TXLINE_JWT_TOKEN}",
    "X-Api-Token": settings.TXLINE_API_KEY,
    "Accept-Encoding": "gzip",
}
MAX_INTERVALS = 70
END_ACTIONS = {"game_finalised"}
EPOCH = date(1970, 1, 1)


def dt_to_slot(dt: datetime):
    epoch_day = (dt.date() - EPOCH).days
    hour_of_day = dt.hour
    interval = dt.minute // 5
    return epoch_day, hour_of_day, interval


def next_slot(epoch_day, hour_of_day, interval):
    interval += 1
    if interval > 11:
        interval = 0
        hour_of_day += 1
        if hour_of_day > 23:
            hour_of_day = 0
            epoch_day += 1
    return epoch_day, hour_of_day, interval


def normalize_event(raw: dict) -> dict:
    def pick(*keys, default=None):
        for k in keys:
            if k in raw and raw[k] is not None:
                return raw[k]
        return default

    data = pick("Data", "dataSoccer", "data", default={}) or {}
    clock_raw = pick("Clock", "clock", default=None)
    clock = None
    if clock_raw:
        clock = {
            "Running": clock_raw.get("Running", clock_raw.get("running")),
            "Seconds": clock_raw.get("Seconds", clock_raw.get("seconds")),
        }
    return {
        "FixtureId": pick("FixtureId", "fixtureId"),
        "Action": pick("Action", "action"),
        "Id": pick("Id", "id"),
        "Ts": pick("Ts", "ts"),
        "Seq": pick("Seq", "seq"),
        "StatusId": pick("StatusId", "statusId", "statusSoccerId"),
        "Clock": clock,
        "Data": data,
    }


async def fetch_events(
    client: httpx.AsyncClient, fixture_id: int, kickoff_str: str
) -> list[dict]:
    kickoff_dt = datetime.fromisoformat(kickoff_str.replace("+00", "+00:00"))
    start_dt = kickoff_dt - timedelta(hours=2)
    day, hour, itv = dt_to_slot(start_dt)

    all_events = []
    seen_end = False

    for _ in range(MAX_INTERVALS):
        url = BASE_URL.format(epochDay=day, hourOfDay=hour, interval=itv)
        resp = await client.get(
            url, headers=HEADERS, params={"fixtureId": fixture_id}, timeout=30
        )

        if resp.status_code == 401:
            print(f"[{fixture_id}] JWT expired -- stopping")
            return all_events
        if resp.status_code != 200:
            day, hour, itv = next_slot(day, hour, itv)
            continue

        for raw in resp.json():
            event = normalize_event(raw)
            if event.get("Action") in END_ACTIONS:
                seen_end = True
            all_events.append(event)

        if seen_end:
            break
        day, hour, itv = next_slot(day, hour, itv)
        await asyncio.sleep(0.2)

    all_events.sort(key=lambda e: (e.get("Ts") or 0, e.get("Seq") or 0))
    return all_events


def diff(new_anchors: list[dict], existing_rows) -> None:
    existing_by_status = {r.status_id: r for r in existing_rows}
    print(
        f"\n  {'phase':<14}{'status_id':<11}{'minute_start':<14}{'running':<9}utc_start"
    )
    for a in new_anchors:
        prior = existing_by_status.get(a["status_id"])
        if prior is None:
            marker = "NEW"
        elif prior.minute_start == a["minute_start"] and prior.running == a["running"]:
            marker = "SAME"
        else:
            marker = "CHANGED"
        print(
            f"  {a['phase']:<14}{a['status_id']:<11}{a['minute_start']:<14}{str(a['running']):<9}{a['utc_start'].isoformat()}  [{marker}]"
        )


async def process_fixture(
    client: httpx.AsyncClient, fixture_id: int, kickoff_str: str, write: bool
) -> None:
    print(f"\n=== Fixture {fixture_id} ===")
    events = await fetch_events(client, fixture_id, kickoff_str)
    if not events:
        print("  No events returned -- check fixture_id / feed availability.")
        return

    anchors = extract_anchors_from_events(fixture_id, events)
    if not anchors:
        print("  No anchors extracted from replay -- check event data.")
        return

    async with AsyncSessionLocal() as session:
        existing = await get_anchors(session, fixture_id)
        diff(anchors, existing)

        if write:
            for anchor in anchors:
                await save_anchor(session, anchor)
            print(f"  Wrote {len(anchors)} anchor rows.")
        else:
            print("  Dry run only -- pass --write to commit.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture-id", type=int)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    with open("fixture_kickoffs.json") as f:
        kickoffs = json.load(f)

    async with httpx.AsyncClient() as client:
        if args.fixture_id:
            kickoff_str = kickoffs.get(str(args.fixture_id))
            if kickoff_str is None:
                parser.error(
                    f"fixture-id {args.fixture_id} not found in fixture_kickoffs.json"
                )
            await process_fixture(client, args.fixture_id, kickoff_str, args.write)
        elif args.all:
            for fixture_id_str, kickoff_str in kickoffs.items():
                await process_fixture(
                    client, int(fixture_id_str), kickoff_str, args.write
                )
        else:
            parser.error("Pass --fixture-id or --all")


if __name__ == "__main__":
    asyncio.run(main())
