"use client";

import { ClockPlus, ShieldAlert, Volleyball } from "lucide-react";
import { motion } from "motion/react";
import type { LogicalRange } from "lightweight-charts";
import { useMemo, useState } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MatchEvent, ProbabilityPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FootballActionIcon, footballIconName } from "../match-view/annotation-ui";

import { logicalIndexToPercent, parseMinuteLabel } from "./chart-utils";

const CLUSTER_DISTANCE_MINUTES = 5;
const MAX_VISIBLE_CLUSTER_EVENTS = 3;

type PositionedEvent = {
  clusterId: string;
  clusterIndex: number;
  clusterSize: number;
  event: MatchEvent;
  index: number;
  left: number;
  minute: number;
};

type EventCluster = {
  clusterId: string;
  events: PositionedEvent[];
  left: number;
  offsetX: number;
  totalSize: number;
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

function minuteValue(value: string) {
  return parseMinuteLabel(value);
}

function eventPriority(event: MatchEvent) {
  const metadata = [
    event.type,
    event.annotationAction,
    event.annotationIcon,
    event.label,
    event.detailLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (metadata.includes("goal")) return 0;
  if (metadata.includes("red-card") || metadata.includes("red_card") || metadata.includes("red card")) return 1;
  if (metadata.includes("penalty")) return 2;
  if (metadata.includes("yellow-card") || metadata.includes("yellow_card") || metadata.includes("yellow card")) return 3;
  if (event.importance === "high") return 4;
  if (event.type === "var") return 5;
  if (event.importance === "medium") return 6;
  if (event.importance === "structural") return 8;
  return 7;
}

function pickVisibleClusterEvents(group: PositionedEvent[]) {
  return [...group]
    .sort((left, right) => {
      const priorityDelta = eventPriority(left.event) - eventPriority(right.event);
      if (priorityDelta !== 0) return priorityDelta;
      if (left.minute !== right.minute) return left.minute - right.minute;
      return left.index - right.index;
    })
    .slice(0, MAX_VISIBLE_CLUSTER_EVENTS)
    .sort((left, right) => {
      if (left.minute !== right.minute) return left.minute - right.minute;
      return left.index - right.index;
    });
}

function sortChronologically(events: PositionedEvent[]) {
  return [...events].sort((left, right) => {
    if (left.minute !== right.minute) return left.minute - right.minute;
    return left.index - right.index;
  });
}

function overflowOffset(index: number) {
  const direction = index % 2 === 0 ? 1 : -1;
  const distance = Math.floor(index / 2) + 1;
  return direction * distance * 34;
}

function primaryClusterEvent(cluster: EventCluster) {
  return [...cluster.events].sort((left, right) => {
    const priorityDelta = eventPriority(left.event) - eventPriority(right.event);
    if (priorityDelta !== 0) return priorityDelta;
    if (left.minute !== right.minute) return left.minute - right.minute;
    return left.index - right.index;
  })[0]?.event;
}

function buildEventIndexes(events: MatchEvent[], renderedHistory: ProbabilityPoint[]) {
  const minuteIndexes = renderedHistory.map((point, index) => ({
    index,
    minute: minuteValue(point.minuteLabel),
  }));

  return events.map((event) => {
    const eventMinute = minuteValue(event.minuteLabel);
    let pointIndex = 0;

    for (const point of minuteIndexes) {
      if (point.minute <= eventMinute) {
        pointIndex = point.index;
      }
    }

    return pointIndex;
  });
}

function buildPositionedEvents(
  events: MatchEvent[],
  renderedHistory: ProbabilityPoint[],
  visibleLogicalRange: LogicalRange | null,
) {
  const eventIndexes = buildEventIndexes(events, renderedHistory);
  const positioned = events.map((event, index) => {
    const pointIndex = eventIndexes[index] ?? 0;
    const left = logicalIndexToPercent(pointIndex, visibleLogicalRange, renderedHistory.length);

    return { event, index, left, minute: minuteValue(event.minuteLabel) };
  });

  return positioned.map((item) => ({
    ...item,
    clusterId: item.event.eventId,
    clusterIndex: 0,
    clusterSize: 1,
  }));
}

function buildEventClusters(positionedEvents: PositionedEvent[]) {
  const sorted = [...positionedEvents].sort((left, right) => {
    if (left.minute !== right.minute) return left.minute - right.minute;
    return left.index - right.index;
  });
  const minuteGroups: PositionedEvent[][] = [];

  sorted.forEach((item) => {
    const group = minuteGroups[minuteGroups.length - 1];
    const first = group?.[0];

    if (group && first && item.minute - first.minute <= CLUSTER_DISTANCE_MINUTES) {
      group.push(item);
      return;
    }

    minuteGroups.push([item]);
  });

  const clusters: EventCluster[] = [];

  minuteGroups.forEach((group, groupIndex) => {
    const visibleEvents = pickVisibleClusterEvents(group);
    const visibleIds = new Set(visibleEvents.map((item) => item.event.eventId));
    const overflowEvents = sortChronologically(group.filter((item) => !visibleIds.has(item.event.eventId)));
    const events = visibleEvents.map((item, index) => ({
      ...item,
      clusterId: `${groupIndex}`,
      clusterIndex: index,
      clusterSize: group.length,
    }));
    const left = group.reduce((sum, item) => sum + item.left, 0) / group.length;

    clusters.push({
      clusterId: `${groupIndex}`,
      events,
      left,
      offsetX: 0,
      totalSize: group.length,
    });

    overflowEvents.forEach((item, overflowIndex) => {
      clusters.push({
        clusterId: `${groupIndex}-overflow-${item.event.eventId}`,
        events: [{
          ...item,
          clusterId: `${groupIndex}-overflow-${item.event.eventId}`,
          clusterIndex: 0,
          clusterSize: 1,
        }],
        left: item.left,
        offsetX: overflowOffset(overflowIndex),
        totalSize: 1,
      });
    });
  });

  return clusters.sort((left, right) => {
    if (left.left !== right.left) return left.left - right.left;
    return left.clusterId.localeCompare(right.clusterId);
  });
}

function ClusterSummaryIcon({ cluster }: { cluster: EventCluster }) {
  const primaryEvent = primaryClusterEvent(cluster);
  if (!primaryEvent) return <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />;

  return <EventMarkerIcon event={primaryEvent} />;
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
  const clusters = useMemo(() => buildEventClusters(positionedEvents), [positionedEvents]);

  return (
    <TooltipProvider>
      <div className="absolute inset-x-0 bottom-[5.5rem] h-12 border-t border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 sm:bottom-[8rem] sm:h-12">
        <div className="relative h-full w-full px-4 sm:px-5">
          {clusters.map((cluster, index) => {
            const isExpanded = expandedClusterId === cluster.clusterId;
            const isSelected = cluster.events.some((item) => item.event.eventId === selectedEvent?.eventId);
            const singleEvent = cluster.events.length === 1 ? cluster.events[0] : null;
            const event = singleEvent?.event;
            const toneEvent = event ?? primaryClusterEvent(cluster);
            const zIndex = isExpanded ? 50 : isSelected ? 35 : 20;

            if (singleEvent && event) {
              return (
                <div
                  key={event.eventId}
                  className="absolute top-1/2 z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${singleEvent.left}%`, zIndex }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
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
                          "flex h-8 w-8 items-center justify-center rounded-full border transition-colors hover:z-30",
                          eventMarkerTone(event),
                          selectedEvent?.eventId === event.eventId && "ring-2 ring-white/80",
                        )}
                        aria-label={`${event.minuteLabel} ${event.label}`}
                      >
                        <EventMarkerIcon event={event} />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      <EventMarkerTooltip event={event} />
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            if (!toneEvent) return null;
            return (
              <div
                key={cluster.clusterId}
                className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${cluster.left}%`, zIndex, marginLeft: cluster.offsetX }}
                onMouseEnter={() => setExpandedClusterId(cluster.clusterId)}
                onMouseLeave={() => setExpandedClusterId(null)}
                onFocus={() => setExpandedClusterId(cluster.clusterId)}
              >
                <motion.button
                  type="button"
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: isSelected ? 1.08 : 1 }}
                  transition={{ duration: 0.18, delay: index * 0.03 }}
                  whileHover={{ scale: 1.08 }}
                  className={cn(
                    "relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition-colors hover:z-30",
                    eventMarkerTone(toneEvent),
                    isSelected && "ring-2 ring-white/80",
                  )}
                  aria-label={`${cluster.totalSize} clustered events`}
                >
                  <ClusterSummaryIcon cluster={cluster} />
                  <span className="pointer-events-none absolute -right-1.5 -top-2.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)] px-1 font-mono text-[0.52rem] font-bold text-[var(--terminal-text-strong)]">
                    {cluster.totalSize}
                  </span>
                </motion.button>

                {isExpanded ? (
                  <>
                    <div className="absolute bottom-8 left-1/2 h-4 w-24 -translate-x-1/2" />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.14 }}
                      className="absolute bottom-[2.75rem] left-1/2 z-50 flex max-w-[min(22rem,80vw)] -translate-x-1/2 gap-2 overflow-x-auto border border-[var(--terminal-border)] bg-[var(--terminal-panel)]/98 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.24)] [scrollbar-width:thin]"
                    >
                      {cluster.events.map((positionedEvent) => (
                        <Tooltip key={positionedEvent.event.eventId}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onSelectEvent?.(positionedEvent.event.eventId)}
                              className={cn(
                                "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors hover:scale-105",
                                eventMarkerTone(positionedEvent.event),
                                selectedEvent?.eventId === positionedEvent.event.eventId && "ring-2 ring-white/80",
                              )}
                              aria-label={`${positionedEvent.event.minuteLabel} ${positionedEvent.event.label}`}
                            >
                              <EventMarkerIcon event={positionedEvent.event} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            <EventMarkerTooltip event={positionedEvent.event} />
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </motion.div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
