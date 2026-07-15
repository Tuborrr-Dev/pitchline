import asyncio
from google import genai
from google.genai import types
from app.core.config import settings
from app.processing.significance import Significance
from groq import AsyncGroq


class AIService:

    def __init__(self):
        self.scorer = Significance()
        self.client1 = genai.Client(
            api_key=settings.GEMINI_API_KEY
        )  # <- incase of when we need gemini again so we can switch
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self._lock = asyncio.Semaphore(2)

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

        prompt = f"""You are an elite football analyst who narrates matches entirely in the language of financial markets — think stock rallies, sell-offs, volatility, hedges, dividends, market corrections, bull/bear runs.

EVENT DATA:
- Minute: {event.get("Minute")+1}
- Action: {event.get("Action")}
- Team: {event.get("TeamName")}
- Player: {event.get("PlayerName")}
- Outcome: {event.get("Outcome")} {score_line}
- Why this matters:{significance.reason}
- Type: {event.get("EventType")}

WRITE ONE SENTENCE that:
1. Names the player ({event.get("PlayerName")}) and the minute ({event.get("Minute")+1}) if either is available — never omit them if present.
2. Uses at least one specific financial-market metaphor tied to what actually happened (not a generic one) — e.g. a shot on target is a "bullish breakout," a blocked shot is "resistance holding," a substitution is a "portfolio rebalance," a red card is a "write-down," full-time is "market close."
3. Is between 20 and 35 words — enough to capture real detail, not a fragment.
4. Sounds like a confident market analyst, not a hype man — no exclamation points, no exaggeration.

EXAMPLES OF THE TARGET STYLE:
- "Rashford's 84th-minute strike is a decisive breakout above resistance, sending England's equity soaring to a commanding 4-2 lead over Croatia."
- "Kramaric's introduction for Pasalic reads like a late-session portfolio rebalance, Croatia rotating capital into fresher legs as added time looms."
- "England's shot drifts off target — a failed breakout attempt, volume high but conviction lacking as the market holds its range."
- "Full-time: England close at 4-2, locking in gains from an afternoon of sustained bullish pressure against a resilient Croatian defense."

Now write the sentence for the event above. Output only the sentence, nothing else."""

        async with self._lock:
            # Safe retry wrapper to completely shield your loop from 429 errors
            for attempt in range(5):
                try:
                    # FIX: Swapped to the active high-throughput gemini-3.5-flash model
                    response = await self.client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=100,
                    )
                    text = response.choices[0].message.content.strip()  # <-- wrapppp
                    """response = await self.client.aio.models.generate_content( model="gemini-2.5-flash", contents=prompt,)
                    text = response.text.strip()"""
                    break
                except Exception as e:
                    if "429" in str(e) and attempt < 2:
                        await asyncio.sleep(4)
                        continue
                    raise e

            # Tiny 2.5-second cooldown after a successful request to pace the loop
            await asyncio.sleep(0.5)

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
