import time
from database import engine
from db_models import Base
from fastapi import FastAPI
from models import AnnotationRequest
from AI import generate_annotation
from database import SessionLocal
from fastapi import HTTPException
import traceback
import logging

from db_models import Annotation
from significance import is_significant
from rule_engine import generate_rule_annotation

app = FastAPI()
# tells postgres to create the tables if they don't exist already.
# This is important because we want to make sure that the tables are created before we start inserting data into them.
Base.metadata.create_all(bind=engine)
# this is the main entry point for the annotation service. It will accept json requests and return json responses.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# build prompt
def build_prompt(request: AnnotationRequest):
    return f"""
You are a football analyst.

Your job is to explain football events using the language of financial markets, as if speaking on Wall Street.

Event Details:
- Minute: {request.matchMinute}
- Event: {request.eventType}
- Player: {request.playerName}
- Team: {request.teamCode}
- scoreBefore: {request.scoreBefore}
- scoreAfter: {request.scoreAfter}
- matchContext: {request.matchContext}
- Probability Swing: {request.probability_delta:+.1f}%

Rules:
- Write exactly one sentence.
- Maximum 30 words.
- Don't exaggerate.
- Sound professional.
- Explain why the probability changed.
"""


# the annotation engine will accept json and return a json response
@app.post("/annotate")
def annotate(request: AnnotationRequest):
    db = None
    logger.info(
        "Received annotation request for event %s",
        request.eventId,
    )
    start = time.time()
    prompt = build_prompt(request)
    latency_ms = None
    try:
        db = SessionLocal()
        if is_significant(request):
            annotation = generate_annotation(prompt)
            logger.info(
                "Event %s classified as significant. Using Gemini.",
                request.eventId,
            )
            model = "gemini-2.5-flash"
        else:
            annotation = generate_rule_annotation(request)
            logger.info("Using Rule Engine")
            model = "rule-engine"
        latency_ms = int((time.time() - start) * 1000)
        new_annotation = Annotation(
            event_id=request.eventId,
            fixture_id=request.fixtureId,
            minute=request.matchMinute,
            event_type=request.eventType,
            player_name=request.playerName,
            team_code=request.teamCode,
            score_before=request.scoreBefore,
            score_after=request.scoreAfter,
            probability_delta=request.probability_delta,
            narrative_text=annotation,
            latency_ms=latency_ms,
            model=model,
        )
        db.add(new_annotation)
        db.commit()
        db.refresh(new_annotation)
        logger.info("Saved annotation %s", request.eventId)
    except Exception as e:
        traceback.print_exc()
        logger.error(e)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db:
            db.close()
    return {"status": "accepted"}
