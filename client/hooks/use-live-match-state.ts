"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import { ANNOTATION_API_BASE_URL, getApiBaseUrl } from "@/config/api";
import type { Annotation, LiveMatchState, MatchEvent, MatchStatus } from "@/lib/types";
import {
  annotationEventId,
  annotationToMatchEvent,
  annotationsToMatchEvents,
  isMarketDepthAnnotation,
} from "@/services/annotation-mappers";
import { fetchAnnotationHistory } from "@/services/match-service";
import { deriveTeamCode, mergeMatchEvents } from "@/services/pitchline-mappers";

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

function statusFromGameState(gameState?: string | null): MatchStatus {
  const value = (gameState ?? "").toLowerCase();

  if (value.includes("finished") || value.includes("full") || value === "ft") {
    return "finished";
  }

  return "live";
}

function pushEvent(events: MatchEvent[], event: MatchEvent) {
  return mergeMatchEvents(events, [event]);
}

function normalizeHistory(history: LiveMatchState["history"]) {
  const dedupedByTimestamp = new Map<string, LiveMatchState["history"][number]>();

  history.forEach((point) => {
    if (Number.isNaN(new Date(point.timestamp).getTime())) return;
    dedupedByTimestamp.set(point.timestamp, point);
  });

  return [...dedupedByTimestamp.values()]
    .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
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

function upsertAnnotationRecord(annotations: Annotation[], payload: Annotation) {
  let didUpdate = false;
  const nextAnnotations = annotations.map((annotation) => {
    if (!isSameAnnotation(annotation, payload)) return annotation;
    didUpdate = true;
    return payload;
  });

  return didUpdate ? nextAnnotations : [...annotations, payload];
}

function mergeAnnotationHistory(currentAnnotations: Annotation[], refreshedHistory: Annotation[]) {
  if (refreshedHistory.length === 0) {
    return currentAnnotations;
  }

  return refreshedHistory.reduce(upsertAnnotationRecord, currentAnnotations);
}

function upsertAnnotationEvent(events: MatchEvent[], payload: Annotation, fixture: LiveMatchState["fixture"]) {
  const nextEvent = annotationToMatchEvent(payload, fixture);
  const nextEvents = events.filter((event) => event.eventId !== nextEvent.eventId);
  return pushEvent(nextEvents, nextEvent);
}

function appendAnnotation(current: LiveMatchState, payload: Annotation) {
  if (
    current.annotations.some(
      (annotation) => isSameAnnotation(annotation, payload),
    )
  ) {
    return current;
  }

  return {
    ...current,
    annotations: [...current.annotations, payload],
    events: isMarketDepthAnnotation(payload)
      ? upsertAnnotationEvent(current.events, payload, current.fixture)
      : current.events,
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
        const homeName = payload.homeName?.trim() || current.fixture.teamAName;
        const awayName = payload.awayName?.trim() || current.fixture.teamBName;
        return {
          ...current,
          fixture: {
            ...current.fixture,
            teamAName: homeName,
            teamACode: deriveTeamCode(homeName),
            teamBName: awayName,
            teamBCode: deriveTeamCode(awayName),
            scoreA: payload.homeScore,
            scoreB: payload.awayScore,
            status: statusFromGameState(payload.gameState),
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

        const homeName = payload.homeName?.trim() || current.fixture.teamAName;
        const awayName = payload.awayName?.trim() || current.fixture.teamBName;

        return {
          ...current,
          fixture: {
            ...current.fixture,
            teamAName: homeName,
            teamACode: deriveTeamCode(homeName),
            teamBName: awayName,
            teamBCode: deriveTeamCode(awayName),
            leadProbability: Math.max(payload.homePct, payload.awayPct),
          },
          currentProbabilities: {
            teamA: payload.homePct,
            draw: payload.drawPct,
            teamB: payload.awayPct,
          },
          history,
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
        setState((current) => {
          const annotations = mergeAnnotationHistory(current.annotations, history);

          return {
            ...current,
            annotations,
            events: mergeMatchEvents(current.events, annotationsToMatchEvents(annotations, current.fixture)),
          };
        });

        eventSource = new EventSource(`${ANNOTATION_API_BASE_URL}/stream/${fixtureId}`);

        eventSource.onerror = () => {
          // Annotation SSE is optional — silently ignore when service is offline
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
              annotations: upsertAnnotationRecord(current.annotations, payload),
              events: isMarketDepthAnnotation(payload)
                ? upsertAnnotationEvent(current.events, payload, current.fixture)
                : current.events.filter((event) => event.eventId !== annotationEventId(payload)),
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
      } catch {
        // Annotation service is optional — silently skip when offline
      }
    }

    void initStream();

    return () => {
      isDisposed = true;
      eventSource?.close();
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

