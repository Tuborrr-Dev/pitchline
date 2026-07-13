"use client";

import { Flag, Search, ShieldAlert, Volleyball } from "lucide-react";
import { motion } from "motion/react";
import type { LogicalRange } from "lightweight-charts";

import type { MatchEvent, ProbabilityPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

import { getEventPointIndex, logicalIndexToPercent } from "./chart-utils";

function eventMarkerTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)] shadow-[0_0_18px_rgba(25,239,140,0.22)]";
    case "red-card":
      return "border-[#ff4b6e] bg-[#3a1622] text-[#ff8aa2] shadow-[0_0_18px_rgba(255,75,110,0.25)]";
    case "yellow-card":
      return "border-[#ffd700] bg-[#302509] text-[#ffe36d] shadow-[0_0_18px_rgba(255,215,0,0.2)]";
    case "penalty-awarded":
    case "penalty-scored":
    case "penalty-missed":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)] shadow-[0_0_18px_rgba(16,162,204,0.2)]";
    case "var":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)] shadow-[0_0_18px_rgba(127,174,202,0.2)]";
    default:
      return "border-[var(--terminal-border)] bg-[var(--terminal-panel)] text-[var(--terminal-text-strong)] shadow-[0_0_18px_var(--terminal-shadow)]";
  }
}

function EventMarkerIcon({ event }: { event: MatchEvent }) {
  if (event.type === "goal") return <Volleyball className="h-3.5 w-3.5" strokeWidth={2} />;
  if (event.type === "red-card") return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-current/90" />;
  if (event.type === "yellow-card") return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-[#ffd700]" />;
  if (event.type === "penalty-awarded" || event.type === "penalty-scored" || event.type === "penalty-missed") {
    return <Flag className="h-3.5 w-3.5" strokeWidth={2} />;
  }
  if (event.type === "var") return <Search className="h-3.5 w-3.5" strokeWidth={2} />;
  return <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />;
}

export function EventMarkers({
  events,
  onSelectEvent,
  renderedHistory,
  selectedEvent,
  visibleLogicalRange,
}: {
  events: MatchEvent[];
  onSelectEvent?: (eventId: string) => void;
  renderedHistory: ProbabilityPoint[];
  selectedEvent?: MatchEvent | null;
  visibleLogicalRange: LogicalRange | null;
}) {
  return (
    <div className="absolute inset-x-0 bottom-[5.5rem] h-12 border-t border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 sm:bottom-[8rem] sm:h-12">
      <div className="relative h-full w-full px-4 sm:px-5">
        {events.map((event, index) => {
          const pointIndex = getEventPointIndex(renderedHistory, event);
          const left = logicalIndexToPercent(pointIndex, visibleLogicalRange, renderedHistory.length);

          return (
            <motion.button
              key={event.eventId}
              type="button"
              onClick={() => onSelectEvent?.(event.eventId)}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: selectedEvent?.eventId === event.eventId ? 1.08 : 1,
              }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              whileHover={{ scale: 1.08 }}
              className={cn(
                "absolute top-1/2 z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-colors hover:z-30 sm:h-8 sm:w-8",
                eventMarkerTone(event),
                selectedEvent?.eventId === event.eventId && "ring-2 ring-white/80",
              )}
              style={{ left: `${left}%` }}
              aria-label={`${event.minuteLabel} ${event.label}`}
              title={`${event.minuteLabel} ${event.label}`}
            >
              <EventMarkerIcon event={event} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
