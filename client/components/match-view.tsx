"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  BarChart3,
  Eye,
  EyeOff,
  History,
  PanelRightOpen,
  Settings,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LiveMatchState, MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ProbabilityChart } from "./probability-chart";

function eventTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return event.side === "teamB"
        ? "border-l-[#ff4b6e] bg-[#321b25] text-[#ff8aa2]"
        : "border-l-[#00ff87] bg-[#0f3428] text-[#65ffb8]";
    case "red-card":
      return "border-l-[#ff4b6e] bg-[#321b25] text-[#ff8aa2]";
    case "yellow-card":
      return "border-l-[#ffd700] bg-[#322c17] text-[#ffe36d]";
    case "var":
      return "border-l-[#7faeca] bg-[#142333] text-[#9ed2ef]";
    default:
      return "border-l-[#7d8993] bg-[#111820] text-[#d8e0e7]";
  }
}

function eventDeltaLabel(event: MatchEvent) {
  if (!event.delta) return "Volatility low";
  const side = event.side === "teamB" ? "FRA" : event.side === "teamA" ? "ARG" : "MKT";
  return `${event.delta > 0 ? "+" : ""}${event.delta.toFixed(1)}% ${side} equity`;
}

function TeamPlate({
  code,
  name,
  probability,
  align = "left",
}: {
  code: string;
  name: string;
  probability: number;
  align?: "left" | "right";
}) {
  const flagClass =
    code === "ARG"
      ? "bg-[linear-gradient(180deg,#80c7ff_0_33%,#fff_33%_66%,#80c7ff_66%)]"
      : "bg-[linear-gradient(90deg,#1f4fd8_0_33%,#fff_33%_66%,#ef3b4d_66%)]";

  return (
    <div className={cn("flex items-center gap-4", align === "right" && "justify-end text-right")}>
      {align === "left" ? <span className={cn("h-12 w-16 border border-[#52606d]", flagClass)} /> : null}
      <div>
        <p className="font-display text-[2.15rem] font-bold uppercase leading-none text-[#e7edf2]">
          {name}
        </p>
        <p className={cn("mt-1 font-mono text-[0.72rem] font-semibold uppercase", probability > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]")}>
          W {probability.toFixed(1)}% (Final)
        </p>
      </div>
      {align === "right" ? <span className={cn("h-12 w-16 border border-[#52606d]", flagClass)} /> : null}
    </div>
  );
}

export function MatchView({
  state,
  selectedEvent,
  selectedEventId,
  onSelectEvent,
}: {
  state: LiveMatchState;
  selectedEvent: MatchEvent | null;
  selectedEventId: string | null;
  onSelectEvent: (eventId: string) => void;
}) {
  const { fixture, currentProbabilities, history, events, activeNarrative, connectionState, lastUpdatedAt } =
    state;
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [eventRailOpen, setEventRailOpen] = useState(true);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-white">
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-[linear-gradient(90deg,rgba(25,239,140,0.03)_1px,transparent_1px),linear-gradient(rgba(127,174,202,0.04)_1px,transparent_1px)] bg-[size:28px_28px]",
          eventRailOpen ? "lg:grid-cols-[auto_1fr]" : "lg:grid-cols-1",
        )}
      >
        <AnimatePresence initial={false}>
          {eventRailOpen ? (
            <motion.aside
              key="event-rail"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "17.5rem" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="min-h-0 overflow-hidden border-r border-[var(--terminal-border)] bg-[#0a0f14]"
            >
              <div className="flex h-full w-[17.5rem] flex-col">
                <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-3 py-3">
                  <div>
                    <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#dce6ed]">
                      Market Depth / Events
                    </p>
                    <p className="mt-1 font-mono text-[0.66rem] uppercase text-[#7d8993]">
                      {fixture.phase} / {fixture.teamACode} vs {fixture.teamBCode}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setEventRailOpen(false)}
                    className="h-7 w-7 cursor-pointer rounded-none border border-[#26313a] bg-transparent p-0 text-[#9fb0bc] shadow-none hover:bg-[#111820]"
                    aria-label="Hide event rail"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {events.map((event, index) => (
                    <motion.button
                      key={event.eventId}
                      type="button"
                      onClick={() => onSelectEvent(event.eventId)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: index * 0.025 }}
                      whileHover={{ x: 3 }}
                      className={cn(
                        "block w-full cursor-pointer border-l-4 border-b border-[#162029] px-3 py-3 text-left font-mono uppercase transition-colors hover:bg-[#111820]",
                        eventTone(event),
                        selectedEventId === event.eventId && "ring-1 ring-inset ring-[var(--terminal-green)]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="min-w-[3.2rem] text-[0.68rem] text-[#d8e0e7]">[{event.minuteLabel}]</span>
                        <div>
                          <p className="text-[0.72rem] font-semibold">{event.label}</p>
                          <p className="mt-1 text-[0.68rem]">{eventDeltaLabel(event)}</p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="border-t border-[var(--terminal-border)] px-3 py-4">
                  <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#dce6ed]">Market Status</p>
                  <motion.div
                    layout
                    className="mt-3 border border-[#066e78] bg-[#071b22] px-3 py-2 text-center font-mono text-[0.72rem] font-semibold uppercase text-[#10d5ff]"
                  >
                    {connectionState === "live" ? "Open - Live" : connectionState}
                  </motion.div>
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <section className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden">
          {!eventRailOpen ? (
            <Button
              type="button"
              onClick={() => setEventRailOpen(true)}
              className="fixed left-3 top-16 z-30 h-8 cursor-pointer rounded-none border border-[#26313a] bg-[#0d1319] px-2 font-mono text-[0.68rem] uppercase text-[#9fb0bc] shadow-none hover:bg-[#111820]"
            >
              <Eye className="h-4 w-4" />
              Events
            </Button>
          ) : null}

          <motion.section
            layout
            className="grid shrink-0 grid-cols-1 items-center border-b border-[var(--terminal-border)] bg-[radial-gradient(circle_at_center,rgba(127,174,202,0.08),transparent_42%)] px-5 py-4 md:grid-cols-[1fr_auto_1fr]"
          >
            <TeamPlate
              code={fixture.teamACode}
              name={fixture.teamAName}
              probability={currentProbabilities.teamA}
            />

            <div className="my-4 text-center md:my-0">
              <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#6f7b84]">
                {fixture.competition} / {fixture.stage}
              </p>
              <div className="mt-2 border border-[#273039] bg-[#0d1319] px-8 py-3 font-display text-[4rem] font-bold leading-none text-[#dfe7ed]">
                {fixture.scoreA} : {fixture.scoreB}
              </div>
              <div className="mx-auto mt-2 w-fit border border-[var(--terminal-green)] bg-[#0b291e] px-3 py-1 font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)]">
                {fixture.teamACode} wins {Math.max(currentProbabilities.teamA - currentProbabilities.teamB, 0).toFixed(1)} on penalties
              </div>
            </div>

            <TeamPlate
              code={fixture.teamBCode}
              name={fixture.teamBName}
              probability={currentProbabilities.teamB}
              align="right"
            />
          </motion.section>

          <section className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--terminal-border)] bg-[#0a0f14] px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button className="h-8 cursor-pointer rounded-none border border-[#0aa5d8] bg-[#06202b] px-3 font-mono text-[0.7rem] uppercase text-[#13c8ff] shadow-none hover:bg-[#092a38]">
                <BarChart3 className="h-4 w-4" />
                Full Match Price Action
              </Button>
              <Button className="h-8 cursor-pointer rounded-none border border-[#44505a] bg-transparent px-3 font-mono text-[0.7rem] uppercase text-[#d9e1e8] shadow-none hover:bg-[#101820]">
                <History className="h-4 w-4" />
                VIX Index
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-mono text-[0.72rem] font-semibold uppercase">
              <span className="text-[var(--terminal-green)]">ARG Equity</span>
              <span className="text-[#ff4b6e]">FRA Equity</span>
              <span className="text-[#10a2cc]">Volatility (VIX)</span>
              <Button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                className="h-8 cursor-pointer rounded-none border border-[#26313a] bg-transparent px-3 font-mono text-[0.7rem] uppercase text-[#9fb0bc] shadow-none hover:bg-[#111820]"
              >
                <PanelRightOpen className="h-4 w-4" />
                {detailsOpen ? "Hide Details" : "Show Details"}
              </Button>
            </div>
          </section>

          <motion.section
            layout
            className={cn(
              "grid min-h-0 flex-1 gap-0 overflow-hidden",
              detailsOpen ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1",
            )}
          >
            <motion.div layout className="min-h-0 min-w-0 w-full overflow-hidden p-5">
              <ProbabilityChart
                teamACode={fixture.teamACode}
                teamBCode={fixture.teamBCode}
                history={history}
                events={events}
                selectedEvent={selectedEvent}
                connectionState={connectionState}
                onSelectEvent={onSelectEvent}
              />
            </motion.div>

            <AnimatePresence>
              {detailsOpen ? (
                <motion.aside
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.18 }}
                  className="min-h-0 overflow-y-auto border-l border-[var(--terminal-border)] bg-[#090e13] p-4"
                >
                  <div className="space-y-4">
                    <section className="border border-[#26313a] bg-[#0d1319] p-4">
                      <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#9fb0bc]">
                        Active Trigger
                      </p>
                      {selectedEvent ? (
                        <div className="mt-3 font-mono uppercase">
                          <p className="text-[0.84rem] font-semibold text-white">{selectedEvent.label}</p>
                          <p className="mt-2 text-[0.72rem] text-[#9fb0bc]">{selectedEvent.minuteLabel}</p>
                          <p className="mt-3 text-[0.72rem] leading-6 text-[#d6dee5]">
                            {selectedEvent.detailLabel ?? eventDeltaLabel(selectedEvent)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 font-mono text-[0.72rem] uppercase text-[#7d8993]">
                          Waiting for market trigger.
                        </p>
                      )}
                    </section>

                    <section className="border border-[#3a3320] bg-[#181409] p-4">
                      <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#ffd700]">
                        Narrative Moment
                      </p>
                      <p className="mt-3 text-[0.9rem] leading-6 text-[#fff1b5]">
                        {activeNarrative?.text ??
                          "No high-significance narrative has fired in the current replay window."}
                      </p>
                    </section>

                    <section className="border border-[#26313a] bg-[#0d1319] p-4">
                      <p className="font-mono text-[0.72rem] font-semibold uppercase text-[#9fb0bc]">
                        Session
                      </p>
                      <div className="mt-3 space-y-2 font-mono text-[0.72rem] uppercase text-[#d6dee5]">
                        <p>Clock: {fixture.minute}</p>
                        <p>Phase: {fixture.phase}</p>
                        <p>
                          Updated:{" "}
                          {new Date(lastUpdatedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="flex items-center gap-2 text-[var(--terminal-green)]">
                          <Activity className="h-4 w-4" />
                          Feed {connectionState}
                        </p>
                      </div>
                    </section>

                    <Button className="h-9 w-full cursor-pointer rounded-none border border-[#26313a] bg-transparent font-mono text-[0.72rem] uppercase text-[#9fb0bc] shadow-none hover:bg-[#111820]">
                      <Settings className="h-4 w-4" />
                      Terminal Settings
                    </Button>
                  </div>
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </section>
      </motion.main>
    </div>
  );
}
