import { ANNOTATION_API_BASE_URL } from "@/config/api";
import type { Annotation, ConnectionState, LiveMatchState } from "@/lib/types";
import {
  clockAnchorsResponseSchema,
  matchHistoryResponseSchema,
  matchResponseSchema,
  type BackendMatchDto,
  type BackendMatchHistoryDto,
  type ClockAnchor,
} from "@/schemas/pitchline";
import { fetchFinishedFixtureIndex, fetchFixtureIndex } from "@/services/fixture-service";
import { getJson } from "@/services/pitchline-http";
import { annotationsToMatchEvents } from "@/services/annotation-mappers";
import {
  createFixtureFromDto,
  formatMinuteLabel,
  historyToProbabilityPoints,
} from "@/services/pitchline-mappers";

export async function fetchInitialLiveMatchState(fixtureId: string): Promise<LiveMatchState | null> {
  const [activeFixtures, finishedFixtures] = await Promise.all([
    fetchFixtureIndex().catch(() => []),
    fetchFinishedFixtureIndex().catch(() => []),
  ]);
  const fixtureMeta = [...activeFixtures, ...finishedFixtures].find(
    (fixture) => fixture.fixtureId === fixtureId,
  );

  if (!fixtureMeta) {
    return null;
  }

  let match: BackendMatchDto | null = null;
  try {
    match = await getJson(`/api/Match/${fixtureId}`, matchResponseSchema);
  } catch {
    match = null;
  }

  let history: BackendMatchHistoryDto | null = null;
  try {
    history = await getJson(`/api/Match/${fixtureId}/history`, matchHistoryResponseSchema);
  } catch {
    history = null;
  }

  const clockAnchors = await fetchClockAnchors(fixtureId);

  const baseFixture = createFixtureFromDto(match ?? fixtureMeta);
  const currentProbabilities = {
    teamA: match?.homePct ?? fixtureMeta.homePct ?? 0,
    draw: match?.drawPct ?? fixtureMeta.drawPct ?? 0,
    teamB: match?.awayPct ?? fixtureMeta.awayPct ?? 0,
  };

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

  const initialHistory = historyToProbabilityPoints(
    history,
    resolvedFixture,
    currentProbabilities,
    clockAnchors,
  );
  const latestHistoryPoint = initialHistory[initialHistory.length - 1];
  const displayProbabilities = latestHistoryPoint
    ? {
        teamA: latestHistoryPoint.teamA,
        draw: latestHistoryPoint.draw,
        teamB: latestHistoryPoint.teamB,
      }
    : currentProbabilities;
  const displayFixture = {
    ...resolvedFixture,
    leadProbability: Math.max(displayProbabilities.teamA, displayProbabilities.teamB),
  };
  const lastTimestamp =
    initialHistory[initialHistory.length - 1]?.timestamp ?? new Date().toISOString();
  const initialAnnotations = await fetchAnnotationHistory(fixtureId);
  const initialEvents = annotationsToMatchEvents(initialAnnotations, displayFixture);

  return {
    fixture: displayFixture,
    currentProbabilities: displayProbabilities,
    history: initialHistory,
    events: initialEvents,
    annotations: initialAnnotations,
    clockAnchors,
    activeNarrative: undefined,
    connectionState:
      resolvedFixture.status !== "finished"
        ? ("connecting" satisfies ConnectionState)
        : ("stale" satisfies ConnectionState),
    lastUpdatedAt: lastTimestamp,
  };
}

export async function fetchClockAnchors(fixtureId: string): Promise<ClockAnchor[]> {
  try {
    const response = await fetch(`${ANNOTATION_API_BASE_URL}/fixtures/${fixtureId}/clock-anchors`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return clockAnchorsResponseSchema.parse(await response.json());
  } catch {
    return [];
  }
}

export async function fetchAnnotationHistory(fixtureId: string): Promise<Annotation[]> {
  try {
    const response = await fetch(`${ANNOTATION_API_BASE_URL}/history/${fixtureId}`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    // Annotation service is optional — silently return empty when offline
    return [];
  }
}
