"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";

import type { LiveMatchState, MatchEvent } from "@/lib/types";

function parseMinuteLabel(minuteLabel: string) {
  return Number.parseInt(minuteLabel.replace(/\D/g, ""), 10) || 0;
}

function buildFixtureSnapshot(state: LiveMatchState, events: MatchEvent[], minuteLabel: string) {
  let scoreA = 0;
  let scoreB = 0;

  for (const item of events) {
    if (item.type !== "goal") continue;
    if (item.side === "teamA") scoreA += 1;
    if (item.side === "teamB") scoreB += 1;
  }

  const minute = parseMinuteLabel(minuteLabel);

  return {
    ...state.fixture,
    scoreA,
    scoreB,
    minute: `${minuteLabel}${minuteLabel.includes("'") ? "" : "'"}`,
    phase: minute >= 46 ? "H2" : "H1",
  };
}

export function useMockMatchState(initialState: LiveMatchState) {
  const [historyIndex, setHistoryIndex] = useState(() => {
    if (initialState.fixture.status !== "live") {
      return initialState.history.length;
    }

    return Math.min(3, initialState.history.length);
  });
  const [hasConnected, setHasConnected] = useState(initialState.fixture.status !== "live");
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const advanceReplay = useEffectEvent(() => {
    startTransition(() => {
      setHistoryIndex((currentIndex) => {
        const nextIndex = Math.min(currentIndex + 1, initialState.history.length);

        if (nextIndex === 6) {
          setIsReconnecting(true);
          window.setTimeout(() => setIsReconnecting(false), 900);
        }

        return nextIndex;
      });
    });
  });

  useEffect(() => {
    if (initialState.fixture.status !== "live") {
      return;
    }

    const liveTimer = window.setTimeout(() => {
      setHasConnected(true);
    }, 800);

    return () => window.clearTimeout(liveTimer);
  }, [initialState.fixture.status]);

  useEffect(() => {
    if (initialState.fixture.status !== "live") {
      return;
    }

    if (historyIndex >= initialState.history.length) {
      return;
    }

    const replayTimer = window.setInterval(() => {
      advanceReplay();
    }, 2200);

    return () => window.clearInterval(replayTimer);
  }, [historyIndex, initialState.fixture.status, initialState.history.length]);

  const state = useMemo<LiveMatchState>(() => {
    const visibleHistory = initialState.history.slice(0, historyIndex);
    const latestPoint = visibleHistory[visibleHistory.length - 1] ?? initialState.history[0];
    const visibleEvents = initialState.events.filter(
      (item) => parseMinuteLabel(item.minuteLabel) <= parseMinuteLabel(latestPoint.minuteLabel),
    );
    const activeNarrative =
      initialState.activeNarrative &&
      visibleEvents.some((item) => item.eventId === initialState.activeNarrative?.eventId)
        ? initialState.activeNarrative
        : undefined;
    const resolvedSelectedEventId =
      selectedEventId ?? visibleEvents[visibleEvents.length - 1]?.eventId ?? null;

    return {
      ...initialState,
      fixture: buildFixtureSnapshot(initialState, visibleEvents, latestPoint.minuteLabel),
      currentProbabilities: {
        teamA: latestPoint.teamA,
        draw: latestPoint.draw,
        teamB: latestPoint.teamB,
      },
      history: visibleHistory,
      events: visibleEvents,
      activeNarrative,
      connectionState:
        initialState.fixture.status !== "live"
          ? initialState.connectionState
          : !hasConnected
            ? "connecting"
            : isReconnecting
              ? "reconnecting"
              : "live",
      lastUpdatedAt: latestPoint.timestamp,
      selectedTimestamp: resolvedSelectedEventId ?? undefined,
    };
  }, [hasConnected, historyIndex, initialState, isReconnecting, selectedEventId]);

  const resolvedSelectedEventId =
    selectedEventId ?? state.events[state.events.length - 1]?.eventId ?? null;
  const selectedEvent =
    state.events.find((item) => item.eventId === resolvedSelectedEventId) ?? null;

  return {
    state,
    selectedEvent,
    selectedEventId: resolvedSelectedEventId,
    setSelectedEventId,
  };
}
