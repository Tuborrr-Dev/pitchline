"use client";

import { useMemo, useState } from "react";

import type { LiveMatchState } from "@/lib/types";

import { MatchView } from "./match-view";

export function HistoryMatchTerminal({ initialState }: { initialState: LiveMatchState }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialState.events[initialState.events.length - 1]?.eventId ?? null,
  );

  const state = useMemo<LiveMatchState>(
    () => ({
      ...initialState,
      connectionState: "stale",
    }),
    [initialState],
  );
  const resolvedSelectedEventId =
    selectedEventId ?? state.events[state.events.length - 1]?.eventId ?? null;
  const selectedEvent =
    state.events.find((event) => event.eventId === resolvedSelectedEventId) ?? null;

  return (
    <div className="relative h-full">
      <MatchView
        followLatest={false}
        state={state}
        selectedEvent={selectedEvent}
        selectedEventId={resolvedSelectedEventId}
        onSelectEvent={setSelectedEventId}
      />
    </div>
  );
}
