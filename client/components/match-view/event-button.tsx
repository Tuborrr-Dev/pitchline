"use client";

import { motion } from "motion/react";

import type { MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  marketDepthHorizontalItemVariants,
  marketDepthItemVariants,
} from "./animation";
import { eventDeltaLabel, eventTone } from "./event-formatting";

export type EventButtonOrientation = "horizontal" | "vertical";

export function EventButton({
  event,
  selected,
  onSelect,
  orientation = "vertical",
  setEventRef,
}: {
  event: MatchEvent;
  selected: boolean;
  onSelect: (eventId: string) => void;
  orientation?: EventButtonOrientation;
  setEventRef?: (
    eventId: string,
    node: HTMLButtonElement | null,
    orientation: EventButtonOrientation,
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
