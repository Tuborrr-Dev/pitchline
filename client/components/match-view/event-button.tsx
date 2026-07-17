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
        orientation === "horizontal" ? "w-[7.75rem] min-w-[7.75rem] border-r px-2 py-1.5 sm:w-auto sm:min-w-[13rem] sm:px-3 sm:py-3" : "block w-full",
        tone,
        selected && "ring-1 ring-inset ring-[var(--terminal-green)]",
      )}
    >
      <div className={cn("flex items-start gap-2", orientation === "horizontal" && "gap-1.5 sm:gap-2")}>
        <span
          className={cn(
            "min-w-[2.7rem] text-[0.6rem] text-[var(--terminal-text-strong)] sm:min-w-[3.2rem] sm:text-[0.68rem]",
            orientation === "horizontal" && "min-w-[2.35rem] text-[0.54rem] sm:min-w-[3.2rem] sm:text-[0.68rem]",
          )}
        >
          [{event.minuteLabel}]
        </span>
        {isAnnotationEvent && hasAnnotationIcon ? (
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center border border-current bg-black/10",
              orientation === "horizontal" && "h-4 w-4 sm:h-5 sm:w-5",
            )}
          >
            <AnnotationGlyph
              action={event.annotationAction}
              icon={event.annotationIcon}
              className={cn("h-3.5 w-3.5", orientation === "horizontal" && "h-3 w-3 sm:h-3.5 sm:w-3.5")}
            />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[0.64rem] font-semibold sm:text-[0.72rem]", orientation === "horizontal" && "text-[0.58rem] leading-none sm:text-[0.72rem] sm:leading-normal")}>{event.label}</p>
          {secondaryLabel ? (
            <p className={cn("mt-1 truncate text-[0.6rem] sm:text-[0.68rem]", orientation === "horizontal" && "mt-0.5 text-[0.54rem] leading-none sm:mt-1 sm:text-[0.68rem] sm:leading-normal")}>{secondaryLabel}</p>
          ) : null}
        </div>
      </div>
      {detailText ? (
        <p
          className={cn(
            "mt-2 whitespace-pre-wrap text-[0.58rem] leading-4 text-[var(--terminal-text-muted)] sm:text-[0.64rem]",
            orientation === "horizontal" && "mt-1 line-clamp-1 whitespace-normal text-[0.54rem] leading-3 sm:mt-2 sm:line-clamp-2 sm:text-[0.64rem] sm:leading-4",
          )}
        >
          {detailText}
        </p>
      ) : null}
    </motion.button>
  );
}
