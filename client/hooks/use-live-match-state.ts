"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  createSystemEvent,
  deriveTeamCode,
  getApiBaseUrl,
} from "@/lib/pitchline-service";
import type { LiveMatchState, MatchEvent } from "@/lib/types";

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
};

function toIsoTimestamp(timestamp?: number) {
  return new Date(timestamp ?? Date.now()).toISOString();
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
        };
      });
    });
  });

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
      .configureLogging(LogLevel.Error)
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
