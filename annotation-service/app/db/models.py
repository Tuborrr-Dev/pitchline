# ORM models for the annotations table in the database.
# This file defines the structure of the Annotation model
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (
    BigInteger,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    UniqueConstraint,
)
from datetime import datetime
from app.db.database import Base

from sqlalchemy import JSON  # add to your existing sqlalchemy import line


class Annotation(Base):
    __tablename__ = "annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    fixture_id: Mapped[int] = mapped_column(Integer, index=True)
    source_action: Mapped[str] = mapped_column(String(50))
    source_id: Mapped[int] = mapped_column(Integer)
    annotation_type: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(50))
    team: Mapped[str | None] = mapped_column(String(120))
    player: Mapped[str | None] = mapped_column(String(120))
    minute: Mapped[int | None] = mapped_column(Integer)
    phase: Mapped[str | None] = mapped_column(String(10))
    home_score: Mapped[int | None] = mapped_column(Integer)
    away_score: Mapped[int | None] = mapped_column(Integer)
    icon: Mapped[str | None] = mapped_column(String(30))
    color: Mapped[str | None] = mapped_column(String(30))
    text: Mapped[str | None] = mapped_column(Text)
    source_seconds: Mapped[int | None] = mapped_column(Integer)
    outcome: Mapped[str | None] = mapped_column(String(50))


class FixtureLineup(Base):
    __tablename__ = "fixture_lineups"
    fixture_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_names: Mapped[dict] = mapped_column(JSON, default=dict)
    player_names: Mapped[dict] = mapped_column(JSON, default=dict)


class ClockAnchor(Base):
    __tablename__ = "clock_anchors"
    __table_args__ = (
        UniqueConstraint(
            "fixture_id", "status_id", name="uq_clock_anchor_fixture_status"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fixture_id: Mapped[int] = mapped_column(BigInteger, index=True)
    phase: Mapped[str] = mapped_column(String)
    status_id: Mapped[int] = mapped_column(Integer)
    utc_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    minute_start: Mapped[int] = mapped_column(Integer)
    seconds_start: Mapped[int] = mapped_column(Integer)
    running: Mapped[bool] = mapped_column(Boolean)
