"use client";

import { EyeOff, Inbox } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { MatchBackButton } from "@/components/match-back-button";
import { TerminalState } from "@/components/terminal-state";
import { Button } from "@/components/ui/button";
import type { ConnectionState, LiveMatchState, MatchEvent } from "@/lib/types";

import {
  marketDepthContainerVariants,
  marketDepthHorizontalItemVariants,
  marketDepthItemVariants,
} from "./animation";
import { EventButton, type EventButtonOrientation } from "./event-button";

type EventRefSetter = (
  eventId: string,
  node: HTMLButtonElement | null,
  orientation: EventButtonOrientation,
) => void;

export function DesktopEventRail({
  connectionState,
  events,
  fixture,
  onSelectEvent,
  onToggle,
  selectedEventId,
  setEventRef,
}: {
  connectionState: ConnectionState;
  events: MatchEvent[];
  fixture: LiveMatchState["fixture"];
  onSelectEvent: (eventId: string) => void;
  onToggle: () => void;
  selectedEventId: string | null;
  setEventRef: EventRefSetter;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.aside
        key="event-rail"
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="hidden w-[17.5rem] shrink-0 overflow-hidden border-r border-[var(--terminal-border)] bg-[var(--terminal-panel)] xl:block xl:min-h-0"
      >
        <motion.div variants={marketDepthContainerVariants} initial="hidden" animate="visible" exit="exit" className="flex h-full min-h-0 w-full flex-col lg:w-[17.5rem]">
          <motion.div variants={marketDepthItemVariants} className="border-b border-[var(--terminal-border)] px-3 py-2">
            <MatchBackButton />
          </motion.div>

          <motion.div variants={marketDepthItemVariants} className="flex items-center justify-between border-b border-[var(--terminal-border)] px-3 py-3">
            <div>
              <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
                Market Depth
              </p>
              <p className="mt-1 font-mono text-[0.66rem] uppercase text-[var(--terminal-text-muted)]">
                {fixture.phase} / {fixture.teamACode} vs {fixture.teamBCode}
              </p>
            </div>
            <Button type="button" onClick={onToggle} className="h-7 w-7 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]" aria-label="Hide event rail">
              <EyeOff className="h-4 w-4" />
            </Button>
          </motion.div>

          <motion.div variants={marketDepthContainerVariants} className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              {events.length > 0 ? (
                events.map((event) => (
                  <EventButton
                    key={event.eventId}
                    event={event}
                    selected={selectedEventId === event.eventId}
                    onSelect={onSelectEvent}
                    setEventRef={setEventRef}
                  />
                ))
              ) : (
                <motion.div key="empty-events" variants={marketDepthItemVariants} className="p-3">
                  <TerminalState
                    icon={Inbox}
                    title="No market events"
                    description="Event depth will populate when the live feed emits annotations or match-state calls."
                    className="min-h-[12rem]"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div variants={marketDepthItemVariants} className="mt-auto border-t border-[var(--terminal-border)] px-3 py-4">
            <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">Market Status</p>
            <motion.div layout className="mt-3 border border-[var(--terminal-blue)] bg-sky-500/10 px-3 py-2 text-center font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-blue)]">
              {connectionState === "live" ? "Open - Live" : connectionState}
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.aside>
    </AnimatePresence>
  );
}

export function MobileEventRail({
  connectionState,
  events,
  fixture,
  onSelectEvent,
  onToggle,
  selectedEventId,
  setEventRef,
}: {
  connectionState: ConnectionState;
  events: MatchEvent[];
  fixture: LiveMatchState["fixture"];
  onSelectEvent: (eventId: string) => void;
  onToggle: () => void;
  selectedEventId: string | null;
  setEventRef: EventRefSetter;
}) {
  return (
    <motion.section
      variants={marketDepthContainerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="border-b border-[var(--terminal-border)] bg-[var(--terminal-panel)] xl:hidden"
    >
      <motion.div variants={marketDepthHorizontalItemVariants} className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-3 py-2">
        <MatchBackButton />
      </motion.div>

      <motion.div variants={marketDepthHorizontalItemVariants} className="flex items-center justify-between gap-3 px-3 py-2">
        <div>
          <p className="font-mono text-[0.7rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
            Market Depth
          </p>
          <p className="font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)]">
            {fixture.phase} / {fixture.teamACode} vs {fixture.teamBCode}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-[var(--terminal-blue)] bg-sky-500/10 px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-blue)]">
            {connectionState === "live" ? "Open - Live" : connectionState}
          </span>
          <Button type="button" onClick={onToggle} className="h-8 w-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]" aria-label="Hide event rail">
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
      <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <motion.div variants={marketDepthContainerVariants} className="flex min-w-max">
          <AnimatePresence mode="popLayout" initial={false}>
            {events.length > 0 ? (
              events.map((event) => (
                <EventButton
                  key={event.eventId}
                  event={event}
                  selected={selectedEventId === event.eventId}
                  onSelect={onSelectEvent}
                  orientation="horizontal"
                  setEventRef={setEventRef}
                />
              ))
            ) : (
              <motion.div key="empty-events" variants={marketDepthHorizontalItemVariants} className="w-screen p-3">
                <TerminalState
                  icon={Inbox}
                  title="No market events"
                  description="Event depth will populate when the live feed emits annotations or match-state calls."
                  className="min-h-[8rem]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.section>
  );
}
