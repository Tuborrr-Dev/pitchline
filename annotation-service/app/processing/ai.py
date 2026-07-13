import asyncio
from google import genai
from google.genai import types
from app.core.config import settings
from app.processing.significance import Significance


class AIService:

    def __init__(self):
        self.scorer = Significance()
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

        # Concurrency guard: Ensures no more than 2 calls hit the API simultaneously
        self._lock = asyncio.Semaphore(2)

    async def generate_annotation(self, event: dict):
        significance = self.scorer.score(event)

        mentions_score = event.get("Action") == "goal" or (
            event.get("Action") == "penalty_outcome"
            and event.get("Outcome") == "Scored"
        )
        score_line = (
            f"\nScore is now {event.get('HomeScore')}-{event.get('AwayScore')}."
            if mentions_score
            else ""
        )

        prompt = f"""You are an elite football analyst.
Explain this football event using the language of financial markets.
Rules:
- Write exactly one sentence.
- Maximum 30 words.
- Don't exaggerate.
- Sound professional.
Event Details:
Minute: {event.get("Minute")}
Action: {event.get("Action")}
Team: {event.get("TeamName")}
Player: {event.get("PlayerName")}
Outcome: {event.get("Outcome")} {score_line}
Reason for significance:
{significance.reason}
Type: {event.get("EventType")}
"""

        async with self._lock:
            # Safe retry wrapper to completely shield your loop from 429 errors
            for attempt in range(3):
                try:
                    # FIX: Swapped to the active high-throughput gemini-3.5-flash model
                    response = await self.client.aio.models.generate_content(
                        model="gemini-3.5-flash",
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            thinking_config=types.ThinkingConfig(
                                thinking_level=types.ThinkingLevel.MINIMAL
                            )
                        ),
                    )
                    text = response.text.strip()
                    break
                except Exception as e:
                    # If it's a rate limit error (429), back off dynamically
                    if "429" in str(e) and attempt < 2:
                        await asyncio.sleep(4)
                        continue
                    raise e

            # Tiny 2.5-second cooldown after a successful request to pace the loop
            await asyncio.sleep(2.5)

        return {
            "type": "annotation",
            "action": event["Action"],
            "minute": event["Minute"],
            "team": event["TeamName"],
            "player": event["PlayerName"],
            "score": significance.score,
            "reason": significance.reason,
            "icon": significance.icon,
            "color": significance.color,
            "text": text,
            "phase": event.get("Phase"),
            "home_score": event.get("HomeScore"),
            "away_score": event.get("AwayScore"),
        }
