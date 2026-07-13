import logging

from fastapi import APIRouter, Request
from app.schemas.models import AnnotationOut, StreamActionOut
from app.services.history_service import HistoryService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/history/{fixture_id}", response_model=list[AnnotationOut])
async def get_history(fixture_id: int):
    history_service = HistoryService()
    rows = await history_service.history(fixture_id)
    return [
        AnnotationOut(
            id=row.id,
            fixture_id=row.fixture_id,
            source_action=row.source_action,
            source_id=row.source_id,
            type=row.annotation_type,
            action=row.action,
            team=row.team,
            player=row.player,
            minute=row.minute,
            phase=row.phase,
            home_score=row.home_score,
            away_score=row.away_score,
            icon=row.icon,
            color=row.color,
            text=row.text,
            outcome=row.outcome,
        )
        for row in rows
    ]


@router.post("/streams/{fixture_id}", response_model=StreamActionOut)
async def start_stream(fixture_id: int, request: Request):
    await request.app.state.stream_manager.start_stream(fixture_id)
    return StreamActionOut(status="watching", fixture_id=fixture_id)


@router.delete("/streams/{fixture_id}", response_model=StreamActionOut)
async def stop_stream(fixture_id: int, request: Request):
    await request.app.state.stream_manager.stop_stream(fixture_id)
    return StreamActionOut(status="stopped", fixture_id=fixture_id)


@router.get("/streams")
async def list_streams(request: Request):
    """For the cron job to check what's already being watched, and for
    how long, so it can decide what to start/stop."""
    stream_manager = request.app.ingestion.stream_manager
    return {
        fixture_id: stream_manager.watch_duration_seconds(fixture_id)
        for fixture_id in stream_manager.tasks.keys()
    }


# ----------------------------
# this is strictly for testing
"""import json
import asyncio


@router.post("/debug/replay")
async def replay_fixture(request: Request):
    with open("fixture_export.json") as f:
        events = json.load(f)

    annotation_service = request.app.state.annotation_service
    processed, failed = 0, 0
    for event in events:
        try:
            await annotation_service.process_event(event)
            processed += 1
        except Exception:
            logger.exception("replay: failed on event %s", event.get("Id"))
            failed += 1
        await asyncio.sleep(
            0.05
        )  # tiny pacing, avoids hammering Gemini in a tight burst

    return {"status": "done", "processed": processed, "failed": failed}"""
