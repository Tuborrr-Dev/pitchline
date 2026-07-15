import logging

from app.db.database import AsyncSessionLocal
from app.db.models import FixtureLineup

logger = logging.getLogger(__name__)


class LineupStore:
    async def save(self, fixture_id: int, team_names: dict, player_names: dict) -> None:
        async with AsyncSessionLocal() as session:
            existing = await session.get(FixtureLineup, fixture_id)
            if existing is None:
                session.add(
                    FixtureLineup(
                        fixture_id=fixture_id,
                        team_names={str(k): v for k, v in team_names.items()},
                        player_names={str(k): v for k, v in player_names.items()},
                    )
                )
            else:
                existing.team_names = {
                    **existing.team_names,
                    **{str(k): v for k, v in team_names.items()},
                }
                existing.player_names = {
                    **existing.player_names,
                    **{str(k): v for k, v in player_names.items()},
                }
            await session.commit()

    async def load(self, fixture_id: int):
        async with AsyncSessionLocal() as session:
            row = await session.get(FixtureLineup, fixture_id)
            if row is None:
                return None
            team_names = {int(k): v for k, v in (row.team_names or {}).items()}
            player_names = {int(k): v for k, v in (row.player_names or {}).items()}
            return team_names, player_names
