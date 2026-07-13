"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  ANNOTATION_API_BASE_URL,
  createSystemEvent,
  deriveTeamCode,
  fetchAnnotationHistory,
  getApiBaseUrl,
  startAnnotationStream,
  stopAnnotationStream,
} from "@/lib/pitchline-service";
import type { Annotation, LiveMatchState, MatchEvent } from "@/lib/types";

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
  timestamp?: number;
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

function mapActionToEventType(action?: string | null): MatchEvent["type"] {
  switch ((action ?? "").toLowerCase()) {
    case "goal":
    case "owngoal":
      return "goal";
    case "redcard":
    case "yellowredcard":
      return "red-card";
    case "halfTime":
    case "halftime":
      return "half-time";
    case "fulltime":
    case "game_finalised":
      return "full-time";
    default:
      return "status";
  }
}

function mapActionToLabel(action?: string | null) {
  switch ((action ?? "").toLowerCase()) {
    case "goal":
      return "Goal update";
    case "owngoal":
      return "Own goal";
    case "redcard":
      return "Red card";
    case "yellowredcard":
      return "Second yellow";
    case "halftime":
    case "halfTime":
      return "Half time";
    case "fulltime":
    case "game_finalised":
      return "Full time";
    default:
      return "Match state synced";
  }
}

function buildScoreEvent(state: LiveMatchState, payload: ScoreUpdatePayload): MatchEvent {
  const minuteLabel = toDisplayMinute(payload.minute);
  const timestamp = toIsoTimestamp(payload.timestamp);
  const teamAScored = payload.homeScore > state.fixture.scoreA;
  const teamBScored = payload.awayScore > state.fixture.scoreB;
  const side = teamAScored ? "teamA" : teamBScored ? "teamB" : "draw";
  const teamCode =
    side === "teamA"
      ? state.fixture.teamACode
      : side === "teamB"
        ? state.fixture.teamBCode
        : undefined;

  return {
    eventId: `${payload.fixtureId}-${payload.action ?? "state"}-${timestamp}`,
    fixtureId: payload.fixtureId,
    type: mapActionToEventType(payload.action),
    minuteLabel,
    timestamp,
    side,
    teamCode,
    label: mapActionToLabel(payload.action),
    detailLabel: `${payload.homeName} ${payload.homeScore} - ${payload.awayScore} ${payload.awayName}`,
    importance: payload.action?.toLowerCase().includes("goal") ? "high" : "medium",
  };
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

export function useLiveMatchState(initialState: LiveMatchState, enabled = true) {
  const [state, setState] = useState(initialState);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialState.events[initialState.events.length - 1]?.eventId ?? null,
  );

  const applyScoreUpdate = useEffectEvent((payload: ScoreUpdatePayload) => {
    startTransition(() => {
      setState((current) => {
        const nextEvent = buildScoreEvent(current, payload);
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
          events: pushEvent(current.events, nextEvent),
          connectionState: "live",
          lastUpdatedAt: nextEvent.timestamp,
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
        // 1. Fetch initial annotation history in case server-side fetch failed or to refresh
        const history = await fetchAnnotationHistory(fixtureId);
        if (isDisposed) return;
        setState((current) => ({
          ...current,
          annotations: history,
        }));

        // 2. Request start of stream on the backend
        await startAnnotationStream(fixtureId);
        if (isDisposed) return;

        // 3. Connect to the SSE endpoint
        const streamUrl = `${ANNOTATION_API_BASE_URL}/stream/${fixtureId}`;
        console.log(`[Annotation Service] Connecting to SSE: ${streamUrl}`);
        eventSource = new EventSource(streamUrl);

        eventSource.onerror = (err) => {
          console.warn("[Annotation Service] SSE connection error / service offline:", err);
        };

        eventSource.onopen = () => {
          console.log("[Annotation Service] SSE Connected");
        };

        // Handle new commentary
        eventSource.addEventListener("commentary", (e) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(e.data) as Annotation;
            setState((current) => {
              // Avoid duplicate additions
              if (current.annotations.some((a) => a.id === payload.id || (a.source_action === payload.source_action && a.source_id === payload.source_id))) {
                return current;
              }
              return {
                ...current,
                annotations: [...current.annotations, payload],
              };
            });
          } catch (err) {
            console.error("Failed to parse commentary SSE payload", err);
          }
        });

        // Handle new AI annotation
        eventSource.addEventListener("annotation", (e) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(e.data) as Annotation;
            setState((current) => {
              // Avoid duplicate additions
              if (current.annotations.some((a) => a.id === payload.id || (a.source_action === payload.source_action && a.source_id === payload.source_id))) {
                return current;
              }
              return {
                ...current,
                annotations: [...current.annotations, payload],
              };
            });
          } catch (err) {
            console.error("Failed to parse annotation SSE payload", err);
          }
        });

        // Handle annotation updates (corrections)
        eventSource.addEventListener("update", (e) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(e.data) as Annotation;
            setState((current) => {
              const nextAnnotations = current.annotations.map((a) => {
                if (
                  a.fixture_id === payload.fixture_id &&
                  a.source_action === payload.source_action &&
                  a.source_id === payload.source_id
                ) {
                  return { ...a, ...payload };
                }
                return a;
              });
              return {
                ...current,
                annotations: nextAnnotations,
              };
            });
          } catch (err) {
            console.error("Failed to parse update SSE payload", err);
          }
        });

        // Handle retraction
        eventSource.addEventListener("retract", (e) => {
          if (isDisposed) return;
          try {
            const payload = JSON.parse(e.data) as {
              fixture_id: number;
              source_action: string;
              source_id: number;
            };
            setState((current) => {
              const nextAnnotations = current.annotations.filter(
                (a) =>
                  !(
                    a.fixture_id === payload.fixture_id &&
                    a.source_id === payload.source_id
                  )
              );
              return {
                ...current,
                annotations: nextAnnotations,
              };
            });
          } catch (err) {
            console.error("Failed to parse retract SSE payload", err);
          }
        });
      } catch (err) {
        console.warn("[Annotation Service] Failed to initialize stream:", err);
      }
    }

    void initStream();

    return () => {
      isDisposed = true;
      if (eventSource) {
        eventSource.close();
      }
      void stopAnnotationStream(fixtureId);
    };
  }, [enabled, initialState.fixture.fixtureId]);

  useEffect(() => {
    if (!enabled) {
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
      .then(async () => {
        if (isDisposed) return;
        await connection.invoke("JoinFixture", initialState.fixture.fixtureId);
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

      const isConnected = connection.state === "Connected";
      if (isConnected) {
        connection
          .invoke("LeaveFixture", initialState.fixture.fixtureId)
          .catch(() => undefined)
          .finally(() => {
            void connection.stop().catch(() => undefined);
          });
      } else {
        void connection.stop().catch(() => undefined);
      }
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
