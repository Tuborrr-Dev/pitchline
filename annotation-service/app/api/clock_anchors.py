from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db.database import AsyncSessionLocal
from app.services.clock_anchor_service import get_anchors

router = APIRouter()


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session


class ClockAnchorOut(BaseModel):
    phase: str
    status_id: int
    utc_start: datetime
    minute_start: int
    seconds_start: int
    running: bool

    class Config:
        from_attributes = True


@router.get("/fixtures/{fixture_id}/clock-anchors", response_model=list[ClockAnchorOut])
async def clock_anchors(fixture_id: int, session=Depends(get_session)):
    rows = await get_anchors(session, fixture_id)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No clock anchors yet for this fixture (match may not have kicked off)",
        )
    return rows
