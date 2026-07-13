from pydantic import BaseModel
from typing import Optional


class AnnotationOut(BaseModel):
    id: int
    fixture_id: int
    source_action: str
    source_id: int
    type: str
    action: str
    team: Optional[str] = None
    player: Optional[str] = None
    minute: Optional[int] = None
    phase: Optional[str] = None
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    text: Optional[str] = None
    outcome: Optional[str] = None


class StreamActionOut(BaseModel):
    status: str
    fixture_id: int
