"""CommentaryService
Receives an already-resolved RULE-tier event and converts it into a
templated commentary payload."""

from app.processing.significance import Significance


class CommentaryService:
    def __init__(self):
        self.significance = Significance()

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
        return f"Shot — {event.get('TeamName')}"

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
        return "Half-time"

    def _game_finalised(self, event):
        return "Full-time"

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
    }
