"use client";

import { Gauge, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLiveMatchState } from "@/hooks/use-live-match-state";
import { useMatchDataReplayState } from "@/hooks/use-match-data-replay-state";
import { useMockMatchState } from "@/hooks/use-mock-match-state";
import type { LiveMatchState } from "@/lib/types";

import { MatchView } from "./match-view";

export function LiveMatchTerminal({
  initialState,
  useMatchDataReplay = false,
  useMockReplay = false,
}: {
  initialState: LiveMatchState;
  useMatchDataReplay?: boolean;
  useMockReplay?: boolean;
}) {
  const [followLatest, setFollowLatest] = useState(false);
  const liveState = useLiveMatchState(initialState, !useMockReplay && !useMatchDataReplay);
  const mockState = useMockMatchState(initialState);
  const replayState = useMatchDataReplayState(initialState, useMatchDataReplay);
  const activeState = useMatchDataReplay
    ? replayState
    : useMockReplay
      ? mockState
      : liveState;
  const { state, selectedEvent, selectedEventId, setSelectedEventId } = activeState;
  const intervalLabel = (intervalMs: number) => {
    if (intervalMs === 60_000) return "1 min";
    return `${intervalMs}ms`;
  };

  return (
    <div className="relative h-full">
      {useMatchDataReplay ? (
        <div className="fixed bottom-3 left-1/2 z-40 flex w-[calc(100vw-1rem)] max-w-[48rem] -translate-x-1/2 flex-col gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-2 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.35)] sm:bottom-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              onClick={replayState.replay.isPlaying ? replayState.replay.pause : replayState.replay.play}
              className="h-8 shrink-0 cursor-pointer rounded-none border border-[var(--terminal-blue)] bg-sky-500/10 px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-blue)] shadow-none hover:bg-sky-500/15 sm:px-3"
            >
              {replayState.replay.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {replayState.replay.isPlaying ? "Pause" : "Play"}
            </Button>
            <Button
              type="button"
              onClick={replayState.replay.stepBackward}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
              aria-label="Step backward"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={replayState.replay.stepForward}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
              aria-label="Step forward"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={replayState.replay.restart}
              className="h-8 shrink-0 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3"
            >
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
            <label className="flex h-8 shrink-0 items-center gap-2 border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)]">
              <Gauge className="h-4 w-4" />
              <select
                value={replayState.replay.intervalMs}
                onChange={(event) => replayState.replay.setIntervalMs(Number(event.target.value) as typeof replayState.replay.intervalMs)}
                className="cursor-pointer bg-transparent text-[var(--terminal-text-strong)] outline-none"
              >
                {replayState.replay.intervalOptions.map((option) => (
                  <option key={option} value={option}>
                    {intervalLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ml-auto flex h-8 shrink-0 cursor-pointer items-center gap-2 border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)]">
              <input
                type="checkbox"
                checked={followLatest}
                onChange={(event) => setFollowLatest(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--terminal-green)]"
              />
              Auto follow
            </label>
          </div>
          <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-2">
            <span className="font-mono text-[0.58rem] uppercase text-[var(--terminal-text-muted)]">
              {replayState.replay.pointCursor}
            </span>
            <div className="min-w-0">
              <input
                type="range"
                min={1}
                max={Math.max(1, replayState.replay.pointTotal)}
                value={replayState.replay.pointCursor}
                onChange={(event) => replayState.replay.jumpToPoint(Number(event.target.value))}
                className="block h-4 w-full cursor-pointer accent-[var(--terminal-green)]"
                aria-label="Skip replay position"
              />
              <div className="h-1.5 bg-[var(--terminal-grid)]">
                <div
                  className="h-full bg-[var(--terminal-green)]"
                  style={{ width: `${Math.round(replayState.replay.progress * 100)}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-[0.58rem] uppercase text-[var(--terminal-text-muted)]">
              {replayState.replay.pointTotal}
            </span>
          </div>
          <p className="truncate font-mono text-[0.58rem] uppercase text-[var(--terminal-text-muted)]">
              Point {replayState.replay.pointCursor} of {replayState.replay.pointTotal}
              {replayState.replay.isFinished ? " complete" : " replaying"}
          </p>
        </div>
      ) : null}
      <MatchView
        followLatest={followLatest}
        state={state}
        selectedEvent={selectedEvent}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
      />
    </div>
  );
}
