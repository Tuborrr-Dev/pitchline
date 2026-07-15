"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import type { LiveMatchState, MatchEvent, ProbabilityPoint } from "@/lib/types";

type ReplayTimelineItem =
  | { kind: "odds"; timestamp: string; index: number }
  | { kind: "event"; timestamp: string; index: number };

const intervalOptions = [60_000, 2500, 1500, 1000, 500, 250] as const;

type ReplayScoreEvent = MatchEvent & {
  replayHomeScore?: number;
  replayAwayScore?: number;
  replayPhase?: string;
};

function timestampMs(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseMinute(minuteLabel: string) {
  return Number.parseInt(minuteLabel.replace(/\D/g, ""), 10) || 0;
}

function buildTimeline(history: ProbabilityPoint[], events: MatchEvent[]) {
  return [
    ...history.map((point, index) => ({
      kind: "odds" as const,
      timestamp: point.timestamp,
      index,
    })),
    ...events.map((event, index) => ({
      kind: "event" as const,
      timestamp: event.timestamp,
      index,
    })),
  ].sort((a, b) => timestampMs(a.timestamp) - timestampMs(b.timestamp));
}

function latestAppliedIndex(timeline: ReplayTimelineItem[], cursor: number, kind: ReplayTimelineItem["kind"]) {
  let latestIndex = -1;

  for (let index = 0; index < cursor; index += 1) {
    const item = timeline[index];
    if (item?.kind === kind) {
      latestIndex = Math.max(latestIndex, item.index);
    }
  }

  return latestIndex;
}

function appliedEvents(timeline: ReplayTimelineItem[], cursor: number, events: MatchEvent[]) {
  const indexes = new Set<number>();

  for (let index = 0; index < cursor; index += 1) {
    const item = timeline[index];
    if (item?.kind === "event") {
      indexes.add(item.index);
    }
  }

  return events.filter((_, index) => indexes.has(index));
}

function fixtureFromReplay(
  initialState: LiveMatchState,
  visibleHistory: ProbabilityPoint[],
  visibleEvents: MatchEvent[],
) {
  const latestPoint = visibleHistory[visibleHistory.length - 1] ?? initialState.history[0];
  const latestEvent = visibleEvents[visibleEvents.length - 1] ?? null;
  const latestMinute = latestEvent?.minuteLabel ?? latestPoint?.minuteLabel ?? "0'";
  const latestReplayEvent = latestEvent
    ? initialState.events.find((event) => event.eventId === latestEvent.eventId)
    : null;
  const scoreEvent = latestReplayEvent as ReplayScoreEvent | null;

  return {
    ...initialState.fixture,
    phase: scoreEvent?.replayPhase ?? (parseMinute(latestMinute) >= 46 ? "2nd Half" : "1st Half"),
    minute: latestMinute,
    scoreA: scoreEvent?.replayHomeScore ?? 0,
    scoreB: scoreEvent?.replayAwayScore ?? 0,
    leadProbability: Math.max(latestPoint?.teamA ?? 0, latestPoint?.teamB ?? 0),
  };
}

export function useMatchDataReplayState(initialState: LiveMatchState, enabled = true) {
  const timeline = useMemo(
    () => buildTimeline(initialState.history, initialState.events),
    [initialState.events, initialState.history],
  );
  const initialCursor = timeline.length > 0 ? 1 : 0;
  const [cursor, setCursor] = useState(initialCursor);
  const [isPlaying, setIsPlaying] = useState(enabled);
  const [intervalMs, setIntervalMs] = useState<(typeof intervalOptions)[number]>(1000);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);



  useEffect(() => {
    if (!enabled || !isPlaying || cursor >= timeline.length) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        setCursor((current) => Math.min(current + 1, timeline.length));
      });
    }, intervalMs);

    return () => window.clearTimeout(timer);
  }, [cursor, enabled, intervalMs, isPlaying, timeline.length]);

  const state = useMemo<LiveMatchState>(() => {
    const latestOddsIndex = latestAppliedIndex(timeline, cursor, "odds");
    const visibleHistory = initialState.history.slice(0, Math.max(1, latestOddsIndex + 1));
    const visibleEvents = appliedEvents(timeline, cursor, initialState.events);
    const latestPoint = visibleHistory[visibleHistory.length - 1] ?? initialState.history[0];

    return {
      ...initialState,
      fixture: fixtureFromReplay(initialState, visibleHistory, visibleEvents),
      currentProbabilities: {
        teamA: latestPoint?.teamA ?? 0,
        draw: latestPoint?.draw ?? 0,
        teamB: latestPoint?.teamB ?? 0,
      },
      history: visibleHistory,
      events: visibleEvents,
      annotations: [],
      connectionState: cursor >= timeline.length ? "stale" : "live",
      lastUpdatedAt: timeline[Math.max(0, cursor - 1)]?.timestamp ?? initialState.lastUpdatedAt,
    };
  }, [cursor, initialState, timeline]);

  const resolvedSelectedEventId =
    selectedEventId ?? state.events[state.events.length - 1]?.eventId ?? null;
  const selectedEvent =
    state.events.find((event) => event.eventId === resolvedSelectedEventId) ?? null;
  const pointCursor = Math.max(1, latestAppliedIndex(timeline, cursor, "odds") + 1);
  const pointTotal = initialState.history.length;
  const progress = pointTotal === 0 ? 1 : pointCursor / pointTotal;
  const jumpTo = (nextCursor: number) => {
    startTransition(() => {
      setCursor(Math.min(Math.max(nextCursor, initialCursor), timeline.length));
    });
  };
  const jumpToPoint = (pointNumber: number) => {
    const pointIndex = Math.min(Math.max(pointNumber - 1, 0), Math.max(pointTotal - 1, 0));
    const timelineIndex = timeline.findIndex(
      (item) => item.kind === "odds" && item.index === pointIndex,
    );

    jumpTo(timelineIndex >= 0 ? timelineIndex + 1 : initialCursor);
  };

  return {
    state,
    selectedEvent,
    selectedEventId: resolvedSelectedEventId,
    setSelectedEventId,
    replay: {
      cursor,
      total: timeline.length,
      pointCursor,
      pointTotal,
      progress,
      isPlaying,
      intervalMs,
      intervalOptions,
      isFinished: cursor >= timeline.length,
      pause: () => setIsPlaying(false),
      play: () => setIsPlaying(true),
      jumpTo,
      jumpToPoint,
      stepBackward: () => jumpTo(cursor - 1),
      stepForward: () => jumpTo(cursor + 1),
      restart: () => {
        setCursor(initialCursor);
        setIsPlaying(true);
        setSelectedEventId(null);
      },
      setIntervalMs,
    },
  };
}
