"use client";

import { motion } from "motion/react";

import type { MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  marketDepthHorizontalItemVariants,
  marketDepthItemVariants,
} from "./animation";
import { AnnotationGlyph, annotationTone } from "./annotation-ui";
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
  const isAnnotationEvent = Boolean(event.annotationColor || event.annotationIcon || event.annotationType);
  const tone = event.annotationColor ? annotationTone(event.annotationColor) : eventTone(event);
  const secondaryLabel = isAnnotationEvent
    ? event.teamCode
    : eventDeltaLabel(event);
  const hasAnnotationIcon = event.annotationIcon === undefined
    ? Boolean(event.annotationAction)
    : Boolean(event.annotationIcon.trim());
  const detailText = event.detailLabel?.trim();

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
        tone,
        selected && "ring-1 ring-inset ring-[var(--terminal-green)]",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-[2.7rem] text-[0.6rem] text-[var(--terminal-text-strong)] sm:min-w-[3.2rem] sm:text-[0.68rem]">[{event.minuteLabel}]</span>
        {isAnnotationEvent && hasAnnotationIcon ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-current bg-black/10">
            <AnnotationGlyph action={event.annotationAction} icon={event.annotationIcon} className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.64rem] font-semibold sm:text-[0.72rem]">{event.label}</p>
          {secondaryLabel ? (
            <p className="mt-1 truncate text-[0.6rem] sm:text-[0.68rem]">{secondaryLabel}</p>
          ) : null}
        </div>
      </div>
      {detailText ? (
        <p
          className={cn(
            "mt-2 whitespace-pre-wrap text-[0.58rem] leading-4 text-[var(--terminal-text-muted)] sm:text-[0.64rem]",
            orientation === "horizontal" && "line-clamp-2 whitespace-normal",
          )}
        >
          {detailText}
        </p>
      ) : null}
    </motion.button>
  );
}
