import logging
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.db.models import Annotation
from app.api.sse import publish

logger = logging.getLogger(__name__)


class HistoryService:
    async def save(self, annotation: dict):
        # 1. Safely calculate the ordinal minute
        raw_minute = annotation.get("minute")
        if raw_minute is not None:
            ordinal_minute = (raw_minute) + 1
            # so both the DB and the Live Stream match have ordinal min
            annotation["minute"] = ordinal_minute
        else:
            annotation["minute"] = None
        async with AsyncSessionLocal() as session:
            row = Annotation(
                fixture_id=annotation["fixture_id"],
                source_action=annotation["source_action"],
                source_id=annotation["source_id"],
                source_seconds=annotation.get("source_seconds"),
                annotation_type=annotation["type"],
                action=annotation["action"],
                team=annotation.get("team"),
                player=annotation.get("player"),
                minute=annotation["minute"],
                phase=annotation.get("phase"),
                home_score=annotation.get("home_score"),
                away_score=annotation.get("away_score"),
                icon=annotation.get("icon"),
                color=annotation.get("color"),
                text=annotation.get("text"),
                outcome=annotation.get("outcome"),
            )
            session.add(row)
            await session.commit()
        await publish(annotation["fixture_id"], annotation)

    # UPDATES the DB record for a given correction event, if it exists, by updating the text field with the new outcome.
    async def update(self, annotation: dict):
        async with AsyncSessionLocal() as session:
            stmt = select(Annotation).where(
                Annotation.fixture_id == annotation["fixture_id"],
                Annotation.source_action == annotation["source_action"],
                Annotation.source_id == annotation["source_id"],
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                logger.warning(
                    "update(): no existing row for %s/%s/%s",
                    annotation["fixture_id"],
                    annotation["source_action"],
                    annotation["source_id"],
                )
                return
            row.team = annotation.get("team")
            row.player = annotation.get("player")
            row.icon = annotation.get("icon")
            row.color = annotation.get("color")
            row.text = annotation.get("text")
            row.outcome = annotation.get("outcome")
            await session.commit()
        await publish(annotation["fixture_id"], {**annotation, "type": "update"})

    # here we dont need time we can delete the record from the DB for a given correction event,
    # if it exists, by using the fixture_id and source_id of the event. If no record is found, it does nothing.
    async def discard(self, correction: dict):
        stmt = (
            select(Annotation)
            .where(
                Annotation.fixture_id == correction["FixtureId"],
                Annotation.source_id == correction["Id"],
            )
            .limit(1)
        )
        async with AsyncSessionLocal() as session:
            result = await session.execute(stmt)
            row = result.scalar_one_or_none()
            if row is None:
                logger.warning(  # <-- this is where we log a warning if no record is found for the given fixture_id and source_idindicating that the discard operation cannot be performed
                    "discard(): no row found for FixtureId=%s Id=%s",
                    correction["FixtureId"],
                    correction["Id"],
                )
                return
            source_action = row.source_action
            source_id = row.source_id
            await session.delete(row)
            await session.commit()
        await publish(
            correction["FixtureId"],
            {
                "type": "retract",
                "fixture_id": correction["FixtureId"],
                "source_action": source_action,
                "source_id": source_id,
            },
        )

    async def history(self, fixture_id: int):
        stmt = (
            select(Annotation)
            .where(Annotation.fixture_id == fixture_id)
            .order_by(Annotation.minute, Annotation.id)
        )
        async with AsyncSessionLocal() as session:
            result = await session.execute(stmt)
            return result.scalars().all()
