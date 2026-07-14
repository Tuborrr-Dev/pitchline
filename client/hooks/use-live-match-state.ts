"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { ANNOTATION_API_BASE_URL, getApiBaseUrl } from "@/config/api";
import type { Annotation, LiveMatchState, MatchEvent } from "@/lib/types";
import {
  annotationEventId,
  annotationToMatchEvent,
  annotationsToMatchEvents,
} from "@/services/annotation-mappers";
import {
  fetchAnnotationHistory,
  startAnnotationStream,
  stopAnnotationStream,
} from "@/services/match-service";
import {
  createSystemEvent,
  deriveTeamCode,
} from "@/services/pitchline-mappers";

type ScoreUpdatePayload = {
  fixtureId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  action?: string | null;
  minute?: string | null;
  gameState?: string | null;
  timestamp?: number;
};

type OddsUpdatePayload = {
  fixtureId: string;
  homeName: string;
  awayName: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  probabilityDelta?: number;
  timestamp?: number | string;
  momentum?: { slope: number; direction: string };
  volatility?: { stdDev: number; level: string };
  marketFreeze?: { isFrozen: boolean; secondsSinceUpdate: number };
  peakSwing?: { delta: number; minute: string };
};

function toIsoTimestamp(timestamp?: number | string) {
  if (typeof timestamp === "string") {
    const parsed = new Date(timestamp).getTime();
    if (!Number.isNaN(parsed) && parsed > 0) return new Date(timestamp).toISOString();
  }
  if (typeof timestamp === "number" && timestamp > 0) {
    return new Date(timestamp).toISOString();
  }
  return new Date().toISOString();
}

function toDisplayMinute(minute?: string | null) {
  const cleanMinute = (minute ?? "").trim();
  if (!cleanMinute) return "0'";
  return cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`;
}

function pushEvent(events: MatchEvent[], event: MatchEvent) {
  const nextEvents = [...events, event];
  return nextEvents.slice(-18);
}

function normalizeHistory(history: LiveMatchState["history"], maxPoints = 120) {
  const dedupedByTimestamp = new Map<string, LiveMatchState["history"][number]>();

  history.forEach((point) => {
    if (Number.isNaN(new Date(point.timestamp).getTime())) return;
    dedupedByTimestamp.set(point.timestamp, point);
  });

  return [...dedupedByTimestamp.values()]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime())
    .slice(-maxPoints);
}

function isExpectedConnectionShutdown(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes("connection was stopped during negotiation") ||
    message.includes("failed to complete negotiation") ||
    message.includes("abort")
  );
}

function isSameAnnotation(
  annotation: Pick<Annotation, "fixture_id" | "source_action" | "source_id">,
  payload: Pick<Annotation, "fixture_id" | "source_action" | "source_id">,
) {
  return (
    annotation.fixture_id === payload.fixture_id &&
    annotation.source_action === payload.source_action &&
    annotation.source_id === payload.source_id
  );
}

function upsertAnnotationEvent(events: MatchEvent[], payload: Annotation, fixture: LiveMatchState["fixture"]) {
  const nextEvent = annotationToMatchEvent(payload, fixture);
  const nextEvents = events.filter((event) => event.eventId !== nextEvent.eventId);
  return pushEvent(nextEvents, nextEvent);
}

function appendAnnotation(current: LiveMatchState, payload: Annotation) {
  if (
    current.annotations.some(
      (annotation) =>
        (payload.id !== undefined && annotation.id === payload.id) ||
        isSameAnnotation(annotation, payload),
    )
  ) {
    return current;
  }

  return {
    ...current,
    annotations: [...current.annotations, payload],
    events: upsertAnnotationEvent(current.events, payload, current.fixture),
  };
}

export function useLiveMatchState(initialState: LiveMatchState, enabled = true) {
  const [state, setState] = useState(initialState);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialState.events[initialState.events.length - 1]?.eventId ?? null,
  );

  const applyScoreUpdate = useEffectEvent((payload: ScoreUpdatePayload) => {
    startTransition(() => {
      setState((current) => {
        return {
          ...current,
          fixture: {
            ...current.fixture,
            teamAName: payload.homeName,
            teamACode: deriveTeamCode(payload.homeName),
            teamBName: payload.awayName,
            teamBCode: deriveTeamCode(payload.awayName),
            scoreA: payload.homeScore,
            scoreB: payload.awayScore,
            phase: payload.gameState?.trim() || current.fixture.phase,
            minute: toDisplayMinute(payload.minute),
            leadProbability: Math.max(
              current.currentProbabilities.teamA,
              current.currentProbabilities.teamB,
            ),
          },
          connectionState: "live",
          lastUpdatedAt: toIsoTimestamp(payload.timestamp),
        };
      });
    });
  });

  const applyOddsUpdate = useEffectEvent((payload: OddsUpdatePayload) => {
    startTransition(() => {
      setState((current) => {
        const timestamp = toIsoTimestamp(payload.timestamp);
        const minuteLabel = current.fixture.status === "live" ? current.fixture.minute : "PRE";
        const nextPoint = {
          timestamp,
          minuteLabel,
          teamA: payload.homePct,
          draw: payload.drawPct,
          teamB: payload.awayPct,
        };
        const history = normalizeHistory(
          current.history[current.history.length - 1]?.timestamp === timestamp
            ? [...current.history.slice(0, -1), nextPoint]
            : [...current.history, nextPoint],
        );

        const seededEvent =
          current.events.length === 0
            ? [
                createSystemEvent(
                  current.fixture,
                  "Live odds tracking active",
                  "Connected to the backend feed. Waiting for score-led moments.",
                  timestamp,
                  minuteLabel,
                ),
              ]
            : current.events;

        return {
          ...current,
          fixture: {
            ...current.fixture,
            teamAName: payload.homeName,
            teamACode: deriveTeamCode(payload.homeName),
            teamBName: payload.awayName,
            teamBCode: deriveTeamCode(payload.awayName),
            leadProbability: Math.max(payload.homePct, payload.awayPct),
          },
          currentProbabilities: {
            teamA: payload.homePct,
            draw: payload.drawPct,
            teamB: payload.awayPct,
          },
          history,
          events: seededEvent,
          connectionState: "live",
          lastUpdatedAt: timestamp,
          analytics: {
            momentum: payload.momentum ?? current.analytics?.momentum,
            volatility: payload.volatility ?? current.analytics?.volatility,
            marketFreeze: payload.marketFreeze ?? current.analytics?.marketFreeze,
            peakSwing: payload.peakSwing ?? current.analytics?.peakSwing,
          },
        };
      });
    });
  });

  useEffect(() => {
    if (!enabled) return;

    const fixtureId = initialState.fixture.fixtureId;
    let isDisposed = false;
    let eventSource: EventSource | null = null;

    async function initStream() {
      try {
        const history = await fetchAnnotationHistory(fixtureId);
        if (isDisposed) return;
        setState((current) => ({
          ...current,
          annotations: history,
          events:
            history.length > 0
              ? annotationsToMatchEvents(history, current.fixture)
              : current.events,
        }));

        await startAnnotationStream(fixtureId);
        if (isDisposed) return;

        eventSource = new EventSource(`${ANNOTATION_API_BASE_URL}/stream/${fixtureId}`);

        eventSource.onerror = (error) => {
          console.warn("[Annotation Service] SSE connection error / service offline:", error);
        };

        eventSource.addEventListener("commentary", (event) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(event.data) as Annotation;
            setState((current) => appendAnnotation(current, payload));
          } catch (error) {
            console.error("Failed to parse commentary SSE payload", error);
          }
        });

        eventSource.addEventListener("annotation", (event) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(event.data) as Annotation;
            setState((current) => appendAnnotation(current, payload));
          } catch (error) {
            console.error("Failed to parse annotation SSE payload", error);
          }
        });

        eventSource.addEventListener("update", (event) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(event.data) as Annotation;
            setState((current) => ({
              ...current,
              annotations: current.annotations.map((annotation) =>
                isSameAnnotation(annotation, payload) ? payload : annotation,
              ),
              events: upsertAnnotationEvent(current.events, payload, current.fixture),
            }));
          } catch (error) {
            console.error("Failed to parse update SSE payload", error);
          }
        });

        eventSource.addEventListener("retract", (event) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(event.data) as {
              fixture_id: number;
              source_action: string;
              source_id: number;
            };
            const eventId = annotationEventId(payload);
            setState((current) => ({
              ...current,
              annotations: current.annotations.filter(
                (annotation) =>
                  !isSameAnnotation(annotation, payload),
              ),
              events: current.events.filter((matchEvent) => matchEvent.eventId !== eventId),
            }));
          } catch (error) {
            console.error("Failed to parse retract SSE payload", error);
          }
        });
      } catch (error) {
        console.warn("[Annotation Service] Failed to initialize stream:", error);
      }
    }

    void initStream();

    return () => {
      isDisposed = true;
      eventSource?.close();
      void stopAnnotationStream(fixtureId);
    };
  }, [enabled, initialState.fixture.fixtureId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (initialState.fixture.status !== "live") {
      return;
    }

    let isDisposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiBaseUrl()}/hubs/match`)
      .withAutomaticReconnect()
      .configureLogging({
        log: (level, message) => {
          if (
            isDisposed &&
            (message.includes("stopped during negotiation") ||
              message.includes("failed to complete negotiation") ||
              message.includes("negotiation"))
          ) {
            return;
          }
          if (level >= LogLevel.Error) {
            console.error(message);
          }
        },
      })
      .build();

    connection.onreconnecting(() => {
      if (isDisposed) return;
      setState((current) => ({ ...current, connectionState: "reconnecting" }));
    });

    connection.onreconnected(async () => {
      if (isDisposed) return;
      await connection.invoke("JoinFixture", initialState.fixture.fixtureId);
      if (isDisposed) return;
      setState((current) => ({ ...current, connectionState: "live" }));
    });

    connection.onclose(() => {
      if (isDisposed) return;
      setState((current) => ({ ...current, connectionState: "offline" }));
    });

    connection.on("ScoreUpdate", applyScoreUpdate);
    connection.on("OddsUpdate", applyOddsUpdate);

    void connection
      .start()
      .then(() => connection.invoke("JoinFixture", initialState.fixture.fixtureId))
      .then(() => {
        if (isDisposed) return;
        setState((current) => ({ ...current, connectionState: "live" }));
      })
      .catch((error) => {
        if (isDisposed || isExpectedConnectionShutdown(error)) {
          return;
        }
        setState((current) => ({ ...current, connectionState: "offline" }));
      });

    return () => {
      isDisposed = true;
      connection.off("ScoreUpdate", applyScoreUpdate);
      connection.off("OddsUpdate", applyOddsUpdate);
      void connection
        .invoke("LeaveFixture", initialState.fixture.fixtureId)
        .catch(() => undefined)
        .finally(() => {
          void connection.stop();
        });
    };
  }, [enabled, initialState.fixture.fixtureId, initialState.fixture.status]);

  const selectedEvent =
    state.events.find((event) => event.eventId === selectedEventId) ??
    state.events[state.events.length - 1] ??
    null;

  return useMemo(
    () => ({
      state,
      selectedEvent,
      selectedEventId,
      setSelectedEventId,
    }),
    [selectedEvent, selectedEventId, state],
  );
}
