"""CommentaryService
Receives an already-resolved RULE-tier event and converts it into a
templated commentary payload."""

from app.processing.significance import Significance


class CommentaryService:
    def __init__(self):
        self.significance = Significance()

    def generate_period_transition(self, event: dict) -> dict | None:
        text = self.PERIOD_TRANSITION_TEXT.get(event.get("StatusId"))
        if text is None:
            return None
        home, away = event.get("HomeScore"), event.get("AwayScore")
        return {
            "type": "commentary",
            "action": "status",
            "team": None,
            "player": None,
            "minute": event.get("Minute"),
            "phase": event.get("Phase"),
            "home_score": home,
            "away_score": away,
            "icon": "clock",
            "color": "gray",
            "text": f"[{home}-{away}] {text}",
        }

    def generate(self, event: dict) -> dict:
        action = event.get("Action")
        handler = self._HANDLERS.get(action)
        if handler is None:
            raise ValueError(f"No commentary template for Action={action!r}")

        style = self.significance.style_rule_tier(event)
        return {
            "type": "commentary",
            "action": action,
            "team": event.get("TeamName"),
            "player": event.get("PlayerName"),
            "minute": event.get("Minute"),
            "phase": event.get("Phase"),
            "home_score": event.get("HomeScore"),
            "away_score": event.get("AwayScore"),
            "icon": style["icon"],
            "color": style["color"],
            "text": handler(self, event),
        }

    # Templates
    def _corner(self, event):
        return f"Corner — {event.get('TeamName')}"

    def _free_kick(self, event):
        return f"Free kick — {event.get('TeamName')}"

    def _shot(self, event):
        team = event.get("TeamName")
        outcome = event.get("Outcome")
        outcome_text = {
            "OnTarget": "on target",
            "OffTarget": "off target",
            "Blocked": "blocked",
            "Woodwork": "off the woodwork",
        }.get(outcome)
        if outcome_text:
            return f"{team} Shot Attempt — ({outcome_text})"
        return f"Shot — {team}"

    def _substitution(self, event):
        return (
            f"Substitution — {event.get('TeamName')}: "
            f"{event.get('PlayerOutName')} OFF, "
            f"{event.get('PlayerInName')} ON"
        )

    def _injury(self, event):
        text = f"Injury — {event.get('TeamName')}"
        if event.get("PlayerName"):
            text += f" {event['PlayerName']}"
        if event.get("Outcome"):
            text += f" [{event['Outcome']}]"
        return text

    def _yellow_card(self, event):
        if event.get("PlayerName"):
            return (
                f"Yellow card — "
                f"{event.get('TeamName')} "
                f"{event.get('PlayerName')}"
            )
        return f"Yellow card — {event.get('TeamName')}"

    def _status(self, event):
        return f"Period change (StatusId {event.get('StatusId')})"

    def _kickoff(self, event):
        if event.get("TeamName"):
            return f"Kickoff — {event.get('TeamName')} get things underway"
        return "Kickoff"

    def _additional_time(self, event):
        mins = event.get("AdditionalTime")
        if mins:
            return f"Additional time: +{mins} min"
        return "Additional time"

    def _halftime_finalised(self, event):
        return f"[{event.get('HomeScore')}-{event.get('AwayScore')}] Half-time"

    def _game_finalised(self, event):
        home, away = event.get("HomeScore"), event.get("AwayScore")
        hs, aws = event.get("HomeShootoutScore"), event.get("AwayShootoutScore")
        if hs is not None and aws is not None:
            winner = (
                event.get("HomeTeamName") if hs > aws else event.get("AwayTeamName")
            )
            return f"[{home}-{away}] Full-time — {winner} win {hs}-{aws} on penalties"
        return f"[{home}-{away}] Full-time"

    def _penalty_outcome(self, event):
        team = event.get("TeamName")
        player = event.get("PlayerName")
        who = player or team
        label = {"Scored": "scores", "Missed": "misses", "Saved": "saved"}.get(
            event.get("Outcome"), event.get("Outcome") or "penalty"
        )
        return (
            f"Penalty shootout — {who}: {label}"
            if who
            else f"Penalty shootout: {label}"
        )

    def _penalty_shootout_team(self, event):
        return f"Penalty shootout — {event.get('TeamName')} to take next"

    def _var(self, event):

        if event.get("VarType"):
            return f"VAR review started ({event.get('VarType')})"
        return "VAR review started"

    def _var_end(self, event):
        if event.get("Outcome"):
            return f"VAR review ended — {event.get('Outcome')}"
        return "VAR review ended"

    _HANDLERS = {
        "corner": _corner,
        "free_kick": _free_kick,
        "shot": _shot,
        "substitution": _substitution,
        "injury": _injury,
        "yellow_card": _yellow_card,
        "status": _status,
        "kickoff": _kickoff,
        "additional_time": _additional_time,
        "halftime_finalised": _halftime_finalised,
        "game_finalised": _game_finalised,
        "penalty_shootout_team": _penalty_shootout_team,
        "var": _var,
        "var_end": _var_end,
        "penalty_outcome": _penalty_outcome,
    }

    PERIOD_TRANSITION_TEXT = {
        6: "Still level — the match goes to Extra-Time",
        8: "Half-time in Extra-Time",
        11: "Extra time over — penalties will decide",
    }
