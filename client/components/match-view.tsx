"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  Eye,
  EyeOff,
  History,
  PanelRightOpen,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Annotation, LiveMatchState, MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ProbabilityChart } from "./probability-chart";

const marketDepthContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.045,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.12 },
  },
} as const;

const marketDepthItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;

const marketDepthHorizontalItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
} as const;

function eventTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return event.side === "teamB"
        ? "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]"
        : "border-l-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]";
    case "red-card":
      return "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]";
    case "yellow-card":
      return "border-l-[var(--signal)] bg-yellow-500/10 text-[#a37200]";
    case "var":
      return "border-l-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)]";
    default:
      return "border-l-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]";
  }
}

function eventDeltaLabel(event: MatchEvent) {
  if (!event.delta) return "Volatility low";
  const side = event.teamCode ?? (event.side === "draw" ? "MKT" : "LIVE");
  return `${event.delta > 0 ? "+" : ""}${event.delta.toFixed(1)}% ${side} equity`;
}

function eventCommentary(event: MatchEvent) {
  return event.detailLabel ?? eventDeltaLabel(event);
}

function isPreKickoffFixture(fixture: LiveMatchState["fixture"]) {
  const kickoffTime = new Date(fixture.kickoffUtc).getTime();
  const metadata = `${fixture.status} ${fixture.phase} ${fixture.minute} ${fixture.competition} ${fixture.stage}`.toLowerCase();
  const kickoffIsFuture = !Number.isNaN(kickoffTime) && kickoffTime > Date.now();

  return (
    fixture.status === "upcoming" ||
    metadata.includes("scheduled") ||
    metadata.includes("not started") ||
    kickoffIsFuture
  );
}

function formatKickoffDate(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(kickoffUtc));
}

import { TeamLogo } from "./team-logo";

import { AnimatedPercentage } from "./animated-percentage";

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
  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-4",
        align === "right" && "justify-end text-right",
        align !== "right" && "justify-start",
      )}
    >
      {align === "left" ? <TeamLogo code={code} name={name} size="md" /> : null}
      <div>
        <p className="font-display text-[1rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:text-[2.15rem]">
          {name}
        </p>
        <p className={cn("mt-1 font-mono text-[0.56rem] font-semibold uppercase sm:text-[0.72rem]", probability > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]")}>
          Win <AnimatedPercentage value={probability} showDeltaBadge />
        </p>
      </div>
      {align === "right" ? <TeamLogo code={code} name={name} size="md" /> : null}
    </div>
  );
}

function EventButton({
  event,
  selected,
  onSelect,
  orientation = "vertical",
  setEventRef,
}: {
  event: MatchEvent;
  selected: boolean;
  onSelect: (eventId: string) => void;
  orientation?: "horizontal" | "vertical";
  setEventRef?: (
    eventId: string,
    node: HTMLButtonElement | null,
    orientation: "horizontal" | "vertical",
  ) => void;
}) {
  return (
    <motion.button
      layout
      ref={(node) => setEventRef?.(event.eventId, node, orientation)}
      type="button"
      onClick={() => onSelect(event.eventId)}
      variants={orientation === "horizontal" ? marketDepthHorizontalItemVariants : marketDepthItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={orientation === "vertical" ? { x: 3 } : { y: -2 }}
      className={cn(
        "cursor-pointer border-l-4 border-b border-[var(--terminal-line)] px-2 py-2 text-left font-mono uppercase transition-colors hover:bg-[var(--terminal-hover)] sm:px-3 sm:py-3",
        orientation === "horizontal" ? "min-w-[10.75rem] border-r sm:min-w-[13rem]" : "block w-full",
        eventTone(event),
        selected && "ring-1 ring-inset ring-[var(--terminal-green)]",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-[2.7rem] text-[0.6rem] text-[var(--terminal-text-strong)] sm:min-w-[3.2rem] sm:text-[0.68rem]">[{event.minuteLabel}]</span>
        <div>
          <p className="text-[0.64rem] font-semibold sm:text-[0.72rem]">{event.label}</p>
          <p className="mt-1 text-[0.6rem] sm:text-[0.68rem]">{eventDeltaLabel(event)}</p>
        </div>
      </div>
    </motion.button>
  );
}

function annotationTone(color?: string) {
  switch (color) {
    case "green":
      return "border-l-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]";
    case "red":
      return "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]";
    case "gold":
      return "border-l-[#ffd700] bg-amber-500/10 text-[#ffd700]";
    case "gray":
    default:
      return "border-l-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]";
  }
}

function CommentaryContent({
  events,
  annotations = [],
  selectedEventId,
}: {
  events: MatchEvent[];
  annotations?: Annotation[];
  selectedEventId: string | null;
}) {
  const hasAnnotations = annotations && annotations.length > 0;

  if (hasAnnotations) {
    const sortedAnnotations = [...annotations].reverse();
    return (
      <section className="flex min-h-0 flex-1 flex-col border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
          <div className="border-b border-[var(--terminal-border)] px-4 py-3">
            <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
              Commentary
            </p>
            <p className="mt-1 font-mono text-[0.66rem] uppercase text-[var(--terminal-text-muted)]">
              Live market notes and match-state calls
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {sortedAnnotations.map((item) => (
              <article
                key={`${item.fixture_id}-${item.source_action}-${item.source_id}-${item.id}`}
                className={cn(
                  "border-b border-[var(--terminal-line)] px-4 py-3 font-mono uppercase last:border-b-0",
                  selectedEventId === `${item.fixture_id}-${item.source_action}-${item.source_id}` && "bg-[var(--terminal-hover)]",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[0.76rem] font-semibold text-[var(--terminal-text-strong)]">
                      {item.action ? item.action.replace(/_/g, " ") : "UPDATE"}
                    </p>
                    <p className="mt-1 text-[0.62rem] text-[var(--terminal-blue)]">
                      {item.minute !== undefined ? `${item.minute}'` : "0'"} / {item.team ?? "market"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 border px-2 py-0.5 text-[0.54rem] font-semibold",
                      annotationTone(item.color),
                    )}
                  >
                    {item.type === "annotation" ? "AI ANALYST" : "LIVE FEED"}
                  </span>
                </div>
                <p className="mt-3 text-[0.68rem] leading-6 text-[var(--terminal-text)] whitespace-pre-wrap">
                  {item.text}
                </p>
                {item.home_score !== null && item.away_score !== null && item.home_score !== undefined && item.away_score !== undefined && (
                  <p className="mt-2 text-[0.62rem] text-[var(--terminal-text-muted)] font-semibold font-mono">
                    SCORE: {item.home_score} - {item.away_score}
                  </p>
                )}
              </article>
            ))}
          </div>
      </section>
    );
  }

  const commentaryFeed = [...events].reverse();

  return (
    <section className="flex min-h-0 flex-1 flex-col border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
        <div className="border-b border-[var(--terminal-border)] px-4 py-3">
          <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
            Commentary
          </p>
          <p className="mt-1 font-mono text-[0.66rem] uppercase text-[var(--terminal-text-muted)]">
            Live market notes and match-state calls
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {commentaryFeed.map((event) => (
            <article
              key={event.eventId}
              className={cn(
                "border-b border-[var(--terminal-line)] px-4 py-3 font-mono uppercase last:border-b-0",
                selectedEventId === event.eventId && "bg-[var(--terminal-hover)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.76rem] font-semibold text-[var(--terminal-text-strong)]">{event.label}</p>
                  <p className="mt-1 text-[0.62rem] text-[var(--terminal-blue)]">
                    {event.minuteLabel} / {event.teamCode ?? "market"}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 border px-2 py-0.5 text-[0.54rem] font-semibold",
                    eventTone(event),
                  )}
                >
                  {event.type.replace(/-/g, " ")}
                </span>
              </div>
              <p className="mt-3 text-[0.68rem] leading-6 text-[var(--terminal-text)]">
                {eventCommentary(event)}
              </p>
            </article>
          ))}
        </div>
    </section>
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
  const { fixture, currentProbabilities, history, events, annotations, connectionState } =
    state;
  const preKickoff = isPreKickoffFixture(fixture);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [eventRailOpen, setEventRailOpen] = useState(true);
  const verticalEventButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const horizontalEventButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  function scrollEventButtonIntoView(eventId: string) {
    const verticalNode = verticalEventButtonRefs.current.get(eventId);
    const horizontalNode = horizontalEventButtonRefs.current.get(eventId);

    if (verticalNode?.offsetParent) {
      verticalNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      return;
    }

    if (horizontalNode?.offsetParent) {
      horizontalNode.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }

  function setEventButtonRef(
    eventId: string,
    node: HTMLButtonElement | null,
    orientation: "horizontal" | "vertical",
  ) {
    const refMap =
      orientation === "horizontal"
        ? horizontalEventButtonRefs.current
        : verticalEventButtonRefs.current;

    if (node) {
      refMap.set(eventId, node);
      if (eventId === selectedEventId) {
        window.requestAnimationFrame(() => scrollEventButtonIntoView(eventId));
      }
      return;
    }

    refMap.delete(eventId);
  }

  useEffect(() => {
    if (!selectedEventId) return;
    const frame = window.requestAnimationFrame(() => scrollEventButtonIntoView(selectedEventId));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedEventId, events.length]);

  return (
    <div className="flex min-h-full flex-col bg-[var(--background)] text-[var(--terminal-text)] xl:h-full xl:overflow-hidden">
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22 }}
        className={cn(
          "grid min-h-full flex-1 grid-cols-1 overflow-y-auto bg-[linear-gradient(90deg,rgba(25,239,140,0.03)_1px,transparent_1px),linear-gradient(rgba(127,174,202,0.04)_1px,transparent_1px)] bg-[size:28px_28px] xl:min-h-0 xl:overflow-hidden",
          eventRailOpen ? "xl:grid-cols-[auto_1fr]" : "xl:grid-cols-1",
        )}
      >
        <AnimatePresence initial={false}>
          {eventRailOpen ? (
            <motion.aside
              key="event-rail"
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="hidden w-[17.5rem] shrink-0 overflow-hidden border-r border-[var(--terminal-border)] bg-[var(--terminal-panel)] xl:block xl:min-h-0"
            >
              <motion.div
                variants={marketDepthContainerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex h-full min-h-0 w-full flex-col lg:w-[17.5rem]"
              >
                <motion.div
                  variants={marketDepthItemVariants}
                  className="flex items-center justify-between border-b border-[var(--terminal-border)] px-3 py-3"
                >
                  <div>
                    <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
                      Market Depth
                    </p>
                    <p className="mt-1 font-mono text-[0.66rem] uppercase text-[var(--terminal-text-muted)]">
                      {fixture.phase} / {fixture.teamACode} vs {fixture.teamBCode}
                      </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setEventRailOpen(false)}
                    className="h-7 w-7 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
                    aria-label="Hide event rail"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </motion.div>

                <motion.div
                  variants={marketDepthContainerVariants}
                  className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {events.map((event) => (
                      <EventButton
                        key={event.eventId}
                        event={event}
                        selected={selectedEventId === event.eventId}
                        onSelect={onSelectEvent}
                        setEventRef={setEventButtonRef}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  variants={marketDepthItemVariants}
                  className="mt-auto border-t border-[var(--terminal-border)] px-3 py-4"
                >
                  <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">Market Status</p>
                  <motion.div
                    layout
                    className="mt-3 border border-[var(--terminal-blue)] bg-sky-500/10 px-3 py-2 text-center font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-blue)]"
                  >
                    {connectionState === "live" ? "Open - Live" : connectionState}
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <section className="flex min-h-0 min-w-0 w-full flex-col overflow-visible xl:overflow-hidden">
          {eventRailOpen ? (
            <motion.section
              variants={marketDepthContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="border-b border-[var(--terminal-border)] bg-[var(--terminal-panel)] xl:hidden"
            >
              <motion.div
                variants={marketDepthHorizontalItemVariants}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
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
                  <Button
                    type="button"
                    onClick={() => setEventRailOpen(false)}
                    className="h-8 w-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent p-0 text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
                    aria-label="Hide event rail"
                  >
                    <EyeOff className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
              <div className="overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <motion.div variants={marketDepthContainerVariants} className="flex min-w-max">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {events.map((event) => (
                      <EventButton
                        key={event.eventId}
                        event={event}
                        selected={selectedEventId === event.eventId}
                        onSelect={onSelectEvent}
                        orientation="horizontal"
                        setEventRef={setEventButtonRef}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.section>
          ) : null}

          {!eventRailOpen ? (
            <Button
              type="button"
              onClick={() => setEventRailOpen(true)}
              className="fixed left-3 top-16 z-30 hidden h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-2 font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] xl:flex"
            >
              <Eye className="h-4 w-4" />
              Events
            </Button>
          ) : null}

          <motion.section
            layout
            className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--terminal-border)] bg-[radial-gradient(circle_at_center,rgba(127,174,202,0.08),transparent_42%)] px-3 py-2 sm:px-5 sm:py-3 md:gap-4"
          >
            <TeamPlate
              code={fixture.teamACode}
              name={fixture.teamAName}
              probability={currentProbabilities.teamA}
            />

            <div className="text-center">
              <p className="hidden font-mono text-[0.58rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:block sm:text-[0.72rem]">
                {fixture.competition} / {fixture.stage}
              </p>
              <div className="mt-1 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 font-display text-[2.25rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:mt-2 sm:px-8 sm:py-3 sm:text-[4rem]">
                {preKickoff ? "Kickoff" : `${fixture.scoreA} : ${fixture.scoreB}`}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1 sm:mt-2">
                <div className="border border-[var(--terminal-green)] bg-emerald-500/10 px-2 py-1 font-mono text-[0.5rem] font-semibold uppercase text-[var(--terminal-green)] sm:px-3 sm:text-[0.72rem]">
                  {preKickoff
                    ? `KO ${formatKickoffDate(fixture.kickoffUtc)} UTC`
                    : `Market edge ${Math.abs(currentProbabilities.teamA - currentProbabilities.teamB).toFixed(1)} pts`}
                </div>
                {state.analytics?.peakSwing?.delta ? (
                  <div className="border border-[#10a2cc] bg-sky-500/10 px-2 py-1 font-mono text-[0.5rem] font-semibold uppercase text-[#10a2cc] sm:px-3 sm:text-[0.72rem]">
                    ⚡ Peak Move +{state.analytics.peakSwing.delta}% ({state.analytics.peakSwing.minute})
                  </div>
                ) : null}
              </div>
            </div>

            <TeamPlate
              code={fixture.teamBCode}
              name={fixture.teamBName}
              probability={currentProbabilities.teamB}
              align="right"
            />
          </motion.section>

          {state.analytics?.marketFreeze?.isFrozen ? (
            <div className="border-b border-[#ff4b6e] bg-[#3a1622] px-4 py-2 text-center font-mono text-[0.72rem] font-semibold uppercase text-[#ff8aa2] shadow-md animate-pulse">
              ⚠️ MARKET SUSPENDED — POSSIBLE VAR REVIEW IN PROGRESS ({state.analytics.marketFreeze.secondsSinceUpdate}s since last odds tick)
            </div>
          ) : null}

          <section className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] sm:px-5 sm:py-3 lg:justify-between [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-2">
              <Button className="h-8 cursor-pointer rounded-none border border-[var(--terminal-blue)] bg-sky-500/10 px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-blue)] shadow-none hover:bg-sky-500/15 sm:px-3 sm:text-[0.7rem]">
                <BarChart3 className="h-4 w-4" />
                <span>Price Action</span>
              </Button>
              <Button className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-strong)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3 sm:text-[0.7rem]">
                <History className="h-4 w-4" />
                VIX Index
              </Button>
              {!eventRailOpen ? (
                <Button
                  type="button"
                  onClick={() => setEventRailOpen(true)}
                  className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3 sm:text-[0.68rem] xl:hidden"
                >
                  <Eye className="h-4 w-4" />
                  Events
                </Button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[0.62rem] font-semibold uppercase sm:gap-4 sm:text-[0.72rem]">
              <span className="text-[var(--terminal-green)]">{fixture.teamACode}</span>
              <span className="text-[#ff4b6e]">{fixture.teamBCode}</span>
              <span className="text-[#10a2cc]">DRAW</span>
              <Button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-2 font-mono text-[0.62rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)] sm:px-3 sm:text-[0.7rem]"
              >
                <PanelRightOpen className="h-4 w-4" />
                {detailsOpen ? "Hide Details" : "Show Details"}
              </Button>
            </div>
          </section>

          <motion.section
            layout
            className={cn(
              "grid min-h-0 flex-1 gap-0 overflow-visible xl:overflow-hidden",
              detailsOpen ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid-cols-1",
            )}
          >
            <motion.div layout className="min-h-0 min-w-0 w-full overflow-visible p-2 sm:p-5 xl:overflow-hidden">
              <ProbabilityChart
                teamACode={fixture.teamACode}
                teamBCode={fixture.teamBCode}
                history={history}
                events={events}
                selectedEvent={selectedEvent}
                connectionState={connectionState}
                analytics={state.analytics}
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
                  className="hidden overflow-y-auto border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-4 xl:block xl:min-h-0 xl:border-l xl:border-t-0"
                >
                  <CommentaryContent events={events} annotations={annotations} selectedEventId={selectedEventId} />
                </motion.aside>
              ) : null}
            </AnimatePresence>
          </motion.section>
        </section>
      </motion.main>

      <AnimatePresence>
        {detailsOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close details"
              className="fixed inset-0 z-40 cursor-pointer bg-black/45 xl:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setDetailsOpen(false)}
            />
            <motion.aside
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-4 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] xl:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
                  Commentary
                </p>
                <Button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-3 font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
                >
                  Close
                </Button>
              </div>
              <CommentaryContent events={events} annotations={annotations} selectedEventId={selectedEventId} />
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
