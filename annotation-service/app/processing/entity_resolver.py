"""
EntityResolver

Two jobs only:
  1. Merge successive TxLine messages for the same real-world event
     (unconfirmed -> confirmed -> enriched) into one canonical event,
     keyed by (FixtureId, Action, Id).
  2. Resolve team/player IDs into names, using data learned from the
     one-time "lineups" message per fixture.

Does NOT handle action_amend / action_discarded -- those target an
already-persisted event in the database, not something this class is
tracking in memory. AnnotationService intercepts them before either
RuleEngine or this class ever sees them, and routes them straight to
HistoryService.

Does NOT receive "lineups" through resolve() either. "lineups" is real
noise for commentary purposes -- there's nothing to say about it -- but
this class still needs its contents. AnnotationService calls
learn_lineups() directly, bypassing RuleEngine.should_process(), the
same pattern used for corrections.
"""

from typing import Optional

import logging

logger = logging.getLogger(__name__)

# StatusId -> Phase name, straight from the TxOdds docs table.
STATUS_PHASE_MAP = {
    1: "NS",
    2: "H1",
    3: "HT",
    4: "H2",
    100: "F",
    6: "WET",
    7: "ET1",
    8: "HTET",
    9: "ET2",
    10: "FET",
    11: "WPE",
    12: "PE",
    13: "FPE",
    14: "I",
    15: "A",
    16: "C",
    17: "TXCC",
    18: "TXCS",
}


class EntityResolver:
    def __init__(self):
        self._store: dict[tuple, dict] = {}
        self.team_names: dict[int, str] = {}
        self.player_names: dict[int, str] = {}
        self.slot_to_team: dict[tuple, int] = {}
        self._scores: dict[int, tuple[int, int]] = {}
        self.home_slot: dict[int, int] = {}

    def learn_lineups(self, event: dict) -> tuple[dict, dict]:
        """this directly goes to AnnotationService on "lineups" messages.
        Returns (team_names, player_names) learned from THIS event only,
        so callers can persist a fixture-scoped snapshot."""
        local_team_names, local_player_names = {}, {}
        for team in event.get("Lineups") or []:
            tid, tname = team.get("normativeId"), team.get("preferredName")
            self.team_names[tid] = tname
            local_team_names[tid] = tname
            for entry in team.get("lineups", []):
                player = entry.get("player", {})
                pid, pname = player.get("normativeId"), player.get("preferredName")
                self.player_names[pid] = pname
                local_player_names[pid] = pname
        logger.info(
            "learn_lineups: fixture now has %d teams, %d players known",
            len(self.team_names),
            len(self.player_names),
        )
        return local_team_names, local_player_names

    def import_lineups(self, team_names: dict, player_names: dict) -> None:
        """Rehydrates in-memory name maps from a previously-persisted
        snapshot, e.g. after a mid-match process restart."""
        self.team_names.update(team_names)
        self.player_names.update(player_names)

    def resolve(self, event: dict) -> dict:
        self._learn_slots(event)
        self._learn_score(event)
        key = self._key(event)
        is_new = key not in self._store
        merged = dict(event) if is_new else self._merge(self._store[key], event)
        self._enrich(merged)
        self._store[key] = merged
        return {
            "kind": "new" if is_new else "update",
            "entity": merged,
        }  # <-- not nevessary anymore

    def _learn_slots(self, event: dict) -> None:
        fixture_id = event.get("FixtureId")
        if (fixture_id, 1) not in self.slot_to_team and event.get("Participant1Id"):
            self.slot_to_team[(fixture_id, 1)] = event.get("Participant1Id")
            self.slot_to_team[(fixture_id, 2)] = event.get("Participant2Id")
            self.home_slot[fixture_id] = 1 if event.get("Participant1IsHome") else 2

    def _learn_score(self, event: dict) -> None:
        score = event.get("Score")
        if not score:
            return
        fixture_id = event.get("FixtureId")
        p1 = score.get("Participant1", {}).get("Total", {}).get("Goals", 0)
        p2 = score.get("Participant2", {}).get("Total", {}).get("Goals", 0)
        self._scores[fixture_id] = (p1, p2)

    def _enrich(self, event: dict) -> None:
        data = event.get("Data", {}) or {}
        fixture_id = event.get("FixtureId")

        slot = event.get("Participant")
        if slot is None:
            slot = data.get("Participant")
        if slot is None and event.get("Action") == "kickoff":
            slot = (event.get("Kickoff") or {}).get("Team")

        team_id = (
            self.slot_to_team.get((fixture_id, slot)) if slot is not None else None
        )
        event["TeamName"] = self.team_names.get(team_id)
        home_slot = self.home_slot.get(fixture_id)
        if slot is None or home_slot is None:
            event["Side"] = "neutral"
        else:
            event["Side"] = "home" if slot == home_slot else "away"

        event["PlayerName"] = self.player_names.get(data.get("PlayerId"))
        event["PlayerInName"] = self.player_names.get(data.get("PlayerInId"))
        event["PlayerOutName"] = self.player_names.get(data.get("PlayerOutId"))

        event["Outcome"] = data.get("Outcome")
        event["AdditionalTime"] = data.get("Minutes")
        event["VarType"] = data.get("Type")
        event["EventType"] = data.get("Type") or data.get("GoalType")
        event["Phase"] = STATUS_PHASE_MAP.get(event.get("StatusId"), "UNKNOWN")

        p1_goals, p2_goals = self._scores.get(fixture_id, (0, 0))
        if event.get("Participant1IsHome"):
            event["HomeScore"], event["AwayScore"] = p1_goals, p2_goals
        else:
            event["HomeScore"], event["AwayScore"] = p2_goals, p1_goals
        clock = event.get("Clock")
        seconds = clock.get("Seconds") if clock else None
        event["Minute"] = (
            (seconds // 60) + 1 if seconds is not None else None
        )  # ordinal minutes

    def _key(self, event: dict) -> tuple:
        return (event.get("FixtureId"), event.get("Action"), event.get("Id"))

    def _merge(self, old: dict, new: dict) -> dict:
        merged = dict(old)
        for k, v in new.items():
            if (
                k == "Data"
                and isinstance(v, dict)
                and isinstance(old.get("Data"), dict)
            ):
                data = dict(old["Data"])
                data.update(v)
                merged["Data"] = data
            else:
                merged[k] = v
        return merged

    def get(self, fixture_id, action, event_id) -> Optional[dict]:
        return self._store.get((fixture_id, action, event_id))

    def apply_amend(self, key: tuple, data: dict) -> Optional[dict]:
        entity = self._store.get(key)
        if entity is None:
            return None
        new_fields = data.get("New", {}) or {}
        merged_data = dict(entity.get("Data", {}) or {})
        for k, v in new_fields.items():
            if k != "Clock":
                merged_data[k] = v
        entity = dict(entity)
        entity["Data"] = merged_data
        self._enrich(entity)
        self._store[key] = entity
        return entity

    # find_target (it's no longer specifically about pending entities, it just locates whatever's tracked)
    def find_target(self, fixture_id: int, data: dict) -> Optional[tuple]:
        target_id = data.get("Id")
        target_action = data.get("Action")
        prev_seconds = ((data.get("Previous") or {}).get("Clock") or {}).get("Seconds")
        for key, entity in self._store.items():
            fid, action, eid = key
            if fid != fixture_id:
                continue
            if target_id is not None and eid == target_id:
                return key
            if (
                action == target_action
                and entity.get("Clock", {}).get("Seconds") == prev_seconds
            ):
                return key
        return None
