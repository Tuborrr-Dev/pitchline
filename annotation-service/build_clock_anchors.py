import argparse
import asyncio
import json

from app.db.database import AsyncSessionLocal
from app.ingestion.txline_client import TxLineClient
from app.services.clock_anchor_service import (
    extract_anchors_from_events,
    save_anchor,
    get_anchors,
)


async def fetch_events(fixture_id: int) -> list[dict]:
    events: list[dict] = []

    async def collect(event: dict):
        events.append(event)

    client = TxLineClient(on_event=collect)
    await client.consume_scores(
        fixture_id
    )  # returns on its own once game_finalised arrives
    return events


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


async def process_fixture(fixture_id: int, write: bool) -> None:
    print(f"\n=== Fixture {fixture_id} ===")
    events = await fetch_events(fixture_id)
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
    parser.add_argument(
        "--all", action="store_true", help="Every fixture ID in fixture_kickoffs.json"
    )
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    if args.fixture_id:
        await process_fixture(args.fixture_id, args.write)
    elif args.all:
        with open("fixture_kickoffs.json") as f:
            fixture_ids = [int(fid) for fid in json.load(f).keys()]
        for fixture_id in fixture_ids:
            await process_fixture(fixture_id, args.write)
    else:
        parser.error("Pass --fixture-id or --all")


if __name__ == "__main__":
    asyncio.run(main())
