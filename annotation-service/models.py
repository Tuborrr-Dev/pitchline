# this describes the models for the annotation service
from pydantic import BaseModel


class MatchContext(BaseModel):
    isComeback: bool
    isLateGoal: bool
    isEqualiser: bool
    isWinningGoal: bool
    redCardActive: bool


class AnnotationRequest(BaseModel):
    eventId: str
    fixtureId: str
    matchMinute: int
    eventType: str
    teamCode: str
    playerName: str
    probability_delta: float
    scoreBefore: str
    scoreAfter: str
    matchContext: MatchContext
