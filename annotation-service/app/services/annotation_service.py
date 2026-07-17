import logging

from app.processing.rule_engine import RuleEngine, CORRECTION_ACTIONS
from app.processing.entity_resolver import EntityResolver
from app.processing.ai import AIService
from app.services.history_service import HistoryService
from app.services.commentary_service import CommentaryService
from app.services.lineup_store import LineupStore

import time
from collections import deque

logger = logging.getLogger(__name__)

DISPLAY_TITLES = {
    "halftime_finalised": "Half-Time",
    "game_finalised": "Match End",
}

STATUS_TITLES = {
    6: "Extra Time",
    8: "Half-Time (ET)",
    11: "Penalties",
}


class AnnotationService:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.entity_resolver = EntityResolver()
        self.ai = AIService()
        self.commentary = CommentaryService()
        self.history = HistoryService()
        self._emitted: set[tuple] = set()
        self.lineup_store = LineupStore()  # (FixtureId, Action, Id) already emitted
        self._latencies: deque[float] = deque(maxlen=50)

    async def restore_lineups(self, fixture_id: int) -> None:
        data = await self.lineup_store.load(fixture_id)
        if data is None:
            return
        team_names, player_names = data
        self.entity_resolver.import_lineups(team_names, player_names)

    async def process_event(self, event: dict):
        action = event.get("Action")

        if action == "lineups":
            team_names, player_names = self.entity_resolver.learn_lineups(event)
            fixture_id = event.get("FixtureId")
            if fixture_id is not None:
                await self.lineup_store.save(fixture_id, team_names, player_names)
            return

        if action == "action_amend":
            await self._handle_amend(event)
            return

        if action == "action_discarded":
            await self.history.discard(event)
            return

        if action == "status":
            await self._handle_period_transition(event)
            return

        # Step 1: Ignore events we don't care about
        if not self.rule_engine.should_process(event):
            return

        # Step 2: Merge lifecycle + resolve names
        resolved = self.entity_resolver.resolve(event)
        entity = resolved["entity"]
        key = (entity.get("FixtureId"), entity.get("Action"), entity.get("Id"))

        if key in self._emitted:
            return

        if not self.rule_engine.is_ready(entity):
            return

        self._emitted.add(key)
        await self._emit(entity, is_update=False)

    async def _handle_period_transition(self, event: dict):
        """The feed's generic 'status' action fires on every phase change. Most
        of those we already never touch. These 3 StatusIds are the only ones with
        no other signal (extra time start, HT of ET, going to penalties)."""
        if event.get("StatusId") not in STATUS_TITLES:
            return

        key = (event.get("FixtureId"), "status", event.get("Id"))
        if key in self._emitted:
            return
        self._emitted.add(key)

        entity = self.entity_resolver.resolve(event)["entity"]
        annotation = self.commentary.generate_period_transition(entity)
        if annotation is None:
            return

        annotation["fixture_id"] = entity.get("FixtureId")
        annotation["source_action"] = STATUS_TITLES[event.get("StatusId")]
        annotation["source_id"] = entity.get("Id")
        clock = entity.get("Clock") or {}
        annotation["source_seconds"] = clock.get("Seconds")
        annotation["outcome"] = None
        await self.history.save(annotation)

    # ------------------------------------------------------------------
    async def _handle_amend(self, event: dict):
        data = event.get("Data", {}) or {}
        fixture_id = event.get("FixtureId")
        key = self.entity_resolver.find_target(fixture_id, data)

        if key is None:
            logger.warning(
                "action_amend: no target found for FixtureId=%s Data=%s",
                fixture_id,
                data,
            )
            return

        entity = self.entity_resolver.apply_amend(key, data)
        if entity is None:
            return

        if key not in self._emitted:
            if self.rule_engine.is_ready(entity):
                self._emitted.add(key)
                await self._emit(entity, is_update=False)
            return

        await self._emit(entity, is_update=True)

    async def _emit(self, entity: dict, is_update: bool):
        if self.rule_engine.is_ai_tier(entity):
            annotation = await self.ai.generate_annotation(entity)
        else:
            annotation = self.commentary.generate(entity)

        self._record_latency(entity)

        annotation["fixture_id"] = entity.get("FixtureId")
        action = entity.get("Action")
        annotation["source_action"] = DISPLAY_TITLES.get(action, action)
        annotation["source_id"] = entity.get("Id")
        clock = entity.get("Clock") or {}
        annotation["source_seconds"] = clock.get("Seconds")
        annotation["outcome"] = entity.get("Outcome")

        if is_update:
            await self.history.update(annotation)
        else:
            await self.history.save(annotation)

    # ----------------------------------------------------
    def _record_latency(self, entity: dict):
        ts = entity.get("Ts")
        if ts is None:
            return
        latency_ms = (time.time() * 1000) - ts
        if latency_ms >= 0:  # guard against clock skew producing a negative
            self._latencies.append(latency_ms)

    def average_latency_ms(self) -> float | None:
        if not self._latencies:
            return None
        return round(sum(self._latencies) / len(self._latencies), 1)
