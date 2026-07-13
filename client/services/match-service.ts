import { fetchFixtureIndex } from "@/services/fixture-service";
import type { LiveMatchState } from "@/lib/types";
import { getJson } from "@/services/pitchline-http";
import {
  createFixtureFromDto,
  createInitialEvents,
  formatMinuteLabel,
  historyToProbabilityPoints,
  toInitialConnectionState,
} from "@/services/pitchline-mappers";
import {
  matchHistoryResponseSchema,
  matchResponseSchema,
  type BackendMatchDto,
  type BackendMatchHistoryDto,
} from "@/schemas/pitchline";

export async function fetchInitialLiveMatchState(fixtureId: string): Promise<LiveMatchState | null> {
  const fixtures = await fetchFixtureIndex();
  const fixtureMeta = fixtures.find((fixture) => fixture.fixtureId === fixtureId);

  if (!fixtureMeta) {
    return null;
  }

  let match: BackendMatchDto | null = null;
  try {
    match = await getJson(`/api/Match/${fixtureId}`, matchResponseSchema);
  } catch {
    match = null;
  }

  const baseFixture = createFixtureFromDto(match ?? fixtureMeta);
  const currentProbabilities = {
    teamA: match?.homePct ?? fixtureMeta.homePct ?? 0,
    draw: match?.drawPct ?? fixtureMeta.drawPct ?? 0,
    teamB: match?.awayPct ?? fixtureMeta.awayPct ?? 0,
  };

  let history: BackendMatchHistoryDto | null = null;
  if (match) {
    try {
      history = await getJson(`/api/Match/${fixtureId}/history`, matchHistoryResponseSchema);
    } catch {
      history = null;
    }
  }

  const resolvedFixture = match
    ? {
        ...baseFixture,
        scoreA: match.homeScore,
        scoreB: match.awayScore,
        phase: match.phase,
        minute: formatMinuteLabel(baseFixture.status, match.minute, match.kickOff),
        leadProbability: Math.max(match.homePct, match.awayPct),
      }
    : baseFixture;

  const initialHistory = historyToProbabilityPoints(history, resolvedFixture, currentProbabilities);
  const lastTimestamp =
    initialHistory[initialHistory.length - 1]?.timestamp ?? new Date().toISOString();
  const initialEvents = createInitialEvents(resolvedFixture);

  return {
    fixture: resolvedFixture,
    currentProbabilities,
    history: initialHistory,
    events: initialEvents,
    activeNarrative: undefined,
    connectionState: toInitialConnectionState(resolvedFixture.status),
    lastUpdatedAt: lastTimestamp,
  };
}
