"use client";

import type { LiveMatchState } from "@/lib/types";

import { useLiveMatchState } from "@/hooks/use-live-match-state";
import { useMockMatchState } from "@/hooks/use-mock-match-state";

import { MatchView } from "./match-view";

export function LiveMatchTerminal({
  initialState,
  useMockReplay = false,
}: {
  initialState: LiveMatchState;
  useMockReplay?: boolean;
}) {
  const liveState = useLiveMatchState(initialState, !useMockReplay);
  const mockState = useMockMatchState(initialState);
  const { state, selectedEvent, selectedEventId, setSelectedEventId } = useMockReplay
    ? mockState
    : liveState;

  return (
    <MatchView
      state={state}
      selectedEvent={selectedEvent}
      selectedEventId={selectedEventId}
      onSelectEvent={setSelectedEventId}
    />
  );
}
