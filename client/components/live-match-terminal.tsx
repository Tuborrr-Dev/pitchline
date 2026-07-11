"use client";

import type { LiveMatchState } from "@/lib/types";

import { useLiveMatchState } from "@/hooks/use-live-match-state";

import { MatchView } from "./match-view";

export function LiveMatchTerminal({ initialState }: { initialState: LiveMatchState }) {
  const { state, selectedEvent, selectedEventId, setSelectedEventId } =
    useLiveMatchState(initialState);

  return (
    <MatchView
      state={state}
      selectedEvent={selectedEvent}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
    />
  );
}
