"""Pipeline order: should_process() -> EntityResolver.resolve() ->
RuleEngine.is_ready(<merged entity>) -> AnnotationService's own
"already emitted?" check -> is_ai_tier()."""

# TIER 0 -- NOISE. Never reaches commentary or AI.
NOISE_ACTIONS = {
    "possession",
    "safe_possession",
    "attack_possession",
    "danger_possession",
    "high_danger_possession",
    "connected",
    "disconnected",
    "coverage_update",
    "clock_adjustment",
    "status",
    "standby",
    "jersey",
    "venue",
    "weather",
    "lineup",
    "lineups",
    "kickoff_team",
    "pitch",
    "players_on_the_pitch",
    "players_on_the_pitch_adjustment",
    "players_warming_up",
    "throw_in",
    "goal_kick",
    "action_invalid",
    "score_adjustment",
    "player_stats_adjustment",
    "possible",
    "suspend",
    "unreliable corners",
    "unreliable_yellow_card",
}

# TIER -1 -- CORRECTIONS. Never reaches should_process() at all -- correctional actions
CORRECTION_ACTIONS = {
    "action_amend",
    "action_discarded",
}

# TIER 1 -- REGULAR COMMENTARY (rule-templated, no Gemini call)
RULE_COMMENTARY_ACTIONS = {
    "corner",
    "free_kick",
    "shot",
    "substitution",
    "injury",
    "yellow_card",
    "kickoff",
    "additional_time",
    "halftime_finalised",
    "game_finalised",
    "penalty_shootout_team",
    "var",
    "var_end",  # promoted to AI tier only if overturned -- check is_ai_tier()
}

# TIER 2 -- ALWAYS AI-WORTHY regardless of Data contents
AI_ACTIONS = {
    "goal",
    "penalty",
    "penalty_outcome",
    "red_card",
}

IMPORTANT_ACTIONS = RULE_COMMENTARY_ACTIONS | AI_ACTIONS

READY_FIELDS = {
    "goal": ("PlayerId",),
    "yellow_card": ("PlayerId",),
    "injury": ("PlayerId", "Outcome"),
    "red_card": ("PlayerId",),
    "penalty_outcome": ("Outcome", "PlayerId"),
}


class RuleEngine:
    IMPORTANT_ACTIONS = IMPORTANT_ACTIONS

    def should_process(self, event: dict) -> bool:
        """Cheap Action-only noise gate. Runs on the RAW event, before
        EntityResolver ever sees it."""
        action = event.get("Action")
        if action is None:
            return False
        return action in self.IMPORTANT_ACTIONS

    def is_ready(self, event: dict) -> bool:
        """False if unconfirmed, or confirmed"""
        if event.get("Confirmed") is False:
            return False
        action = event.get("Action")
        data = event.get("Data", {}) or {}
        if action == "penalty_outcome":
            if data.get("Outcome") == "Scored":
                return data.get("PlayerId") is not None
            return True
        required = READY_FIELDS.get(event.get("Action"))
        if not required:
            return True
        return all(data.get(f) is not None for f in required)

    def is_ai_tier(self, event: dict) -> bool:
        """Called AFTER is_ready() returns True, to route between
        rule-templated commentary and a Gemini call."""
        action = event.get("Action")
        data = event.get("Data", {})
        if action in AI_ACTIONS:
            return True
        if action == "var_end":
            # NOTE: "Stands" = no change = stays regular commentary.
            outcome = data.get("Outcome", "")
            return outcome not in ("Stands", "")
        return False
