from datetime import datetime

from sqlalchemy import Column, Integer, Float, String, DateTime

from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Annotation(Base):

    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)

    event_id = Column(String, unique=True)

    fixture_id = Column(String)

    minute = Column(Integer)

    event_type = Column(String)

    player_name = Column(String)

    team_code = Column(String)

    score_before = Column(String)

    score_after = Column(String)

    probability_delta = Column(Float)

    narrative_text = Column(String)

    latency_ms = Column(Integer)

    model = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow)


# this is the blueprint for the annotation service.
# It will be used to create the database tables and models for the annotation service.
