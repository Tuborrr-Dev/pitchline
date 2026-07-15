"use client";

import { ClockPlus, ShieldAlert, Volleyball } from "lucide-react";
import { motion } from "motion/react";
import type { LogicalRange } from "lightweight-charts";
import { useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MatchEvent, ProbabilityPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FootballActionIcon, footballIconName } from "../match-view/annotation-ui";

import { getEventPointIndex, logicalIndexToPercent } from "./chart-utils";

const CLUSTER_DISTANCE_PERCENT = 2.4;
const CLUSTER_X_GAP = 28;
const CLUSTER_Y_GAP = 11;

type PositionedEvent = {
  clusterId: string;
  clusterIndex: number;
  clusterSize: number;
  event: MatchEvent;
  index: number;
  left: number;
};

function eventMarkerTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]";
    case "red-card":
      return "border-[#ff4b6e] bg-[#3a1622] text-[#ff8aa2]";
    case "yellow-card":
      return "border-[#ffd700] bg-[#302509] text-[#ffe36d]";
    case "penalty-awarded":
    case "penalty-scored":
    case "penalty-missed":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)]";
    case "var":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)]";
    default:
      return "border-[var(--terminal-border)] bg-[var(--terminal-panel)] text-[var(--terminal-text-strong)]";
  }
}

function EventMarkerIcon({ event }: { event: MatchEvent }) {
  const footballIconAction = event.annotationAction ?? event.label;

  if (footballIconName(event.annotationIcon, footballIconAction)) {
    return <FootballActionIcon action={footballIconAction} icon={event.annotationIcon} className="h-4 w-4" />;
  }

  if (event.annotationAction === "additional_time") return <ClockPlus className="h-3.5 w-3.5" strokeWidth={2} />;
  if (event.type === "goal") return <Volleyball className="h-3.5 w-3.5" strokeWidth={2} />;
  if (event.type === "red-card") return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-current/90" />;
  if (event.type === "yellow-card") return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-[#ffd700]" />;
  if (event.type === "penalty-awarded" || event.type === "penalty-scored" || event.type === "penalty-missed") {
    return <FootballActionIcon action="penalty" className="h-4 w-4" />;
  }
  if (event.type === "var") return <FootballActionIcon action="var" className="h-4 w-4" />;
  return <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />;
}

function EventMarkerTooltip({ event }: { event: MatchEvent }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-[var(--terminal-text-strong)]">{event.label}</p>
      <p className="text-[var(--terminal-text-muted)]">
        {event.minuteLabel} / {event.teamCode ?? "market"} / {event.type.replace(/-/g, " ")}
      </p>
      {event.detailLabel ? <p className="normal-case text-[var(--terminal-text)]">{event.detailLabel}</p> : null}
    </div>
  );
}

function buildPositionedEvents(
  events: MatchEvent[],
  renderedHistory: ProbabilityPoint[],
  visibleLogicalRange: LogicalRange | null,
) {
  const positioned = events.map((event, index) => {
    const pointIndex = getEventPointIndex(renderedHistory, event);
    const left = logicalIndexToPercent(pointIndex, visibleLogicalRange, renderedHistory.length);

    return { event, index, left };
  });

  const sorted = [...positioned].sort((left, right) => {
    if (left.left !== right.left) return left.left - right.left;
    return left.index - right.index;
  });

  const clusters: Array<typeof positioned> = [];

  sorted.forEach((item) => {
    const cluster = clusters[clusters.length - 1];
    const previous = cluster?.[cluster.length - 1];

    if (cluster && previous && Math.abs(item.left - previous.left) <= CLUSTER_DISTANCE_PERCENT) {
      cluster.push(item);
      return;
    }

    clusters.push([item]);
  });

  const byEventId = new Map<string, PositionedEvent>();

  clusters.forEach((cluster) => {
    const clusterId = cluster.map((item) => item.event.eventId).join(":");

    cluster.forEach((item, clusterIndex) => {
      byEventId.set(item.event.eventId, {
        ...item,
        clusterId,
        clusterIndex,
        clusterSize: cluster.length,
      });
    });
  });

  return events.map((event) => byEventId.get(event.eventId)).filter(Boolean) as PositionedEvent[];
}

function clusterOffset(positionedEvent: PositionedEvent, isExpanded: boolean) {
  if (!isExpanded || positionedEvent.clusterSize <= 1) {
    return { x: 0, y: 0 };
  }

  const midpoint = (positionedEvent.clusterSize - 1) / 2;
  const distanceFromMidpoint = positionedEvent.clusterIndex - midpoint;

  return {
    x: distanceFromMidpoint * CLUSTER_X_GAP,
    y: (positionedEvent.clusterIndex % 2 === 0 ? -1 : 1) * CLUSTER_Y_GAP,
  };
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
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
  const positionedEvents = useMemo(
    () => buildPositionedEvents(events, renderedHistory, visibleLogicalRange),
    [events, renderedHistory, visibleLogicalRange],
  );

  return (
    <TooltipProvider>
      <div className="absolute inset-x-0 bottom-[5.5rem] h-12 border-t border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 sm:bottom-[8rem] sm:h-12">
        <div className="relative h-full w-full px-4 sm:px-5" onMouseLeave={() => setExpandedClusterId(null)}>
          {positionedEvents.map((positionedEvent) => {
            const { event, index, left } = positionedEvent;
            const isExpanded = expandedClusterId === positionedEvent.clusterId;
            const offset = clusterOffset(positionedEvent, isExpanded);
            const zIndex = isExpanded ? 40 + positionedEvent.clusterIndex : selectedEvent?.eventId === event.eventId ? 35 : 20;

            return (
              <Tooltip key={event.eventId}>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    onClick={() => onSelectEvent?.(event.eventId)}
                    onFocus={() => setExpandedClusterId(positionedEvent.clusterId)}
                    onMouseEnter={() => setExpandedClusterId(positionedEvent.clusterId)}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      x: offset.x,
                      y: offset.y,
                      scale: selectedEvent?.eventId === event.eventId ? 1.08 : 1,
                    }}
                    transition={{ duration: 0.18, delay: isExpanded ? 0 : index * 0.03 }}
                    whileHover={{ scale: 1.08 }}
                    className={cn(
                      "absolute top-1/2 z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-colors hover:z-30 sm:h-8 sm:w-8",
                      eventMarkerTone(event),
                      selectedEvent?.eventId === event.eventId && "ring-2 ring-white/80",
                    )}
                    style={{ left: `${left}%`, zIndex }}
                    aria-label={`${event.minuteLabel} ${event.label}`}
                  >
                    <EventMarkerIcon event={event} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  <EventMarkerTooltip event={event} />
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
