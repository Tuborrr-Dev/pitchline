"use client";

import type { LiveMatchState } from "@/lib/types";

import { useMockMatchState } from "@/hooks/use-mock-match-state";

import { MatchView } from "./match-view";

export function LiveMatchTerminal({ initialState }: { initialState: LiveMatchState }) {
  const { state, selectedEvent, selectedEventId, setSelectedEventId } =
    useMockMatchState(initialState);

  return (
    <MatchView
      state={state}
      selectedEvent={selectedEvent}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
    />
  );
}
