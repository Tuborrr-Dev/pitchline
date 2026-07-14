import { ANNOTATION_API_BASE_URL } from "@/config/api";
import type { Annotation, ConnectionState, LiveMatchState } from "@/lib/types";
import {
  matchHistoryResponseSchema,
  matchResponseSchema,
  type BackendMatchDto,
  type BackendMatchHistoryDto,
} from "@/schemas/pitchline";
import { fetchFinishedFixtureIndex, fetchFixtureIndex } from "@/services/fixture-service";
import { getJson } from "@/services/pitchline-http";
import { annotationsToMatchEvents } from "@/services/annotation-mappers";
import {
  createFixtureFromDto,
  createInitialEvents,
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

  const initialHistory = historyToProbabilityPoints(history, resolvedFixture, currentProbabilities);
  const lastTimestamp =
    initialHistory[initialHistory.length - 1]?.timestamp ?? new Date().toISOString();
  const initialAnnotations = await fetchAnnotationHistory(fixtureId);
  const initialEvents =
    initialAnnotations.length > 0
      ? annotationsToMatchEvents(initialAnnotations, resolvedFixture)
      : createInitialEvents(resolvedFixture);

  return {
    fixture: resolvedFixture,
    currentProbabilities,
    history: initialHistory,
    events: initialEvents,
    annotations: initialAnnotations,
    activeNarrative: undefined,
    connectionState:
      resolvedFixture.status !== "finished"
        ? ("connecting" satisfies ConnectionState)
        : ("stale" satisfies ConnectionState),
    lastUpdatedAt: lastTimestamp,
  };
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
  } catch (error) {
    console.warn("[fetchAnnotationHistory] Unable to fetch annotations history:", error);
    return [];
  }
}

export async function startAnnotationStream(fixtureId: string): Promise<void> {
  try {
    await fetch(`${ANNOTATION_API_BASE_URL}/streams/${fixtureId}`, {
      method: "POST",
    });
  } catch (error) {
    console.warn("[startAnnotationStream] Unable to start annotation stream:", error);
  }
}

export async function stopAnnotationStream(fixtureId: string): Promise<void> {
  try {
    await fetch(`${ANNOTATION_API_BASE_URL}/streams/${fixtureId}`, {
      method: "DELETE",
    });
  } catch (error) {
    console.warn("[stopAnnotationStream] Unable to stop annotation stream:", error);
  }
}
