import logging

from app.processing.rule_engine import RuleEngine, CORRECTION_ACTIONS
from app.processing.entity_resolver import EntityResolver
from app.processing.ai import AIService
from app.services.history_service import HistoryService
from app.services.commentary_service import CommentaryService

logger = logging.getLogger(__name__)


class AnnotationService:
    def __init__(self):
        self.rule_engine = RuleEngine()
        self.entity_resolver = EntityResolver()
        self.ai = AIService()
        self.commentary = CommentaryService()
        self.history = HistoryService()
        self._emitted: set[tuple] = set()  # (FixtureId, Action, Id) already emitted

    async def process_event(self, event: dict):
        action = event.get("Action")

        if action == "lineups":
            self.entity_resolver.learn_lineups(event)
            return

        if action == "action_amend":
            await self._handle_amend(event)
            return

        if action == "action_discarded":
            await self.history.discard(event)
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

        annotation["fixture_id"] = entity.get("FixtureId")
        annotation["source_action"] = entity.get("Action")
        annotation["source_id"] = entity.get("Id")
        annotation["source_seconds"] = entity.get("Clock", {}).get("Seconds")
        annotation["outcome"] = entity.get("Outcome")

        if is_update:
            await self.history.update(annotation)
        else:
            await self.history.save(annotation)
