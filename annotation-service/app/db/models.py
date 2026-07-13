# ORM models for the annotations table in the database.
# This file defines the structure of the Annotation model
from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


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
