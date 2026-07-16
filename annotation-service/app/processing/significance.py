from dataclasses import dataclass


@dataclass
class SignificanceResult:
    score: int
    reason: str
    icon: str
    color: str


class Significance:
    RULE_ICONS = {
        "corner": "corner-flag",
        "free_kick": "whistle",
        "shot": "target",
        "substitution": "substitution",
        "injury": "medical-cross",
        "yellow_card": "yellow-card",
        "status": "clock",
        "kickoff": "whistle",
        "additional_time": "clock",
        "halftime_finalised": "whistle",
        "game_finalised": "checkered-flag",
        "penalty_shootout_team": "target",
        "var": "video",
        "var_end": "video",
        "penalty_outcome": "target",
    }

    def style_rule_tier(self, event: dict) -> dict:
        icon = self.RULE_ICONS.get(event.get("Action"), "circle")
        side = event.get("Side")
        color = {"home": "green", "away": "red"}.get(side, "gray")
        return {"icon": icon, "color": color}

    def score(self, event: dict) -> SignificanceResult:
        result = self._score_raw(event)
        result.color = "gold"
        return result

    def _score_raw(self, event: dict) -> SignificanceResult:
        action = event.get("Action")
        minute = event.get("Minute") or 0
        outcome = event.get("Outcome")

        # GOALS
        if action == "goal":
            if minute >= 90:
                return SignificanceResult(
                    score=30,
                    reason="Late goal",
                    icon="soccer_ball",
                    color="gold",
                )
            if minute >= 75:
                return SignificanceResult(
                    score=25,
                    reason="Late goal",
                    icon="soccer_ball",
                    color="gold",
                )
            return SignificanceResult(
                score=20,
                reason="Goal",
                icon="soccer_ball",
                color="gold",
            )

        # PENALTIES
        if action == "penalty":
            return SignificanceResult(
                score=18,
                reason="Penalty awarded",
                icon="",
                color="gold",
            )
        if action == "penalty_outcome":
            if outcome == "Scored":
                return SignificanceResult(
                    score=25,
                    reason="Penalty scored",
                    icon="Goal-Post",
                    color="gold",
                )
            return SignificanceResult(
                score=20,
                reason="Penalty missed",
                icon="X-mark",
                color="gold",
            )

        # RED CARD
        if action == "red_card":
            return SignificanceResult(
                score=22,
                reason="Red card",
                icon="red-square",
                color="gold",
            )

        # VAR OVERTURN
        if action == "var_end":
            return SignificanceResult(
                score=20,
                reason="VAR decision",
                icon="video",
                color="gold",
            )
        return SignificanceResult(
            score=0,
            reason="Unknown",
            icon="circle",
            color="gold",
        )
