import { MessageSquareDashed } from "lucide-react";

import { TerminalState } from "@/components/terminal-state";
import type { Annotation, MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AnnotationGlyph, annotationId, annotationTone } from "./annotation-ui";
import { eventCommentary } from "./event-formatting";

function minuteValue(value?: number | string | null) {
  if (typeof value === "number") return value;
  return Number.parseInt(String(value ?? "").replace(/\D/g, ""), 10) || 0;
}

type CommentaryFeedItem =
  | { annotation: Annotation; index: number; kind: "annotation" }
  | { event: MatchEvent; kind: "event"; minute: number };

export function CommentaryContent({
  annotations = [],
  events,
  selectedEventId,
}: {
  annotations?: Annotation[];
  events: MatchEvent[];
  selectedEventId: string | null;
}) {
  const commentaryFeed: CommentaryFeedItem[] =
    annotations.length > 0
      ? annotations
          .map(
            (annotation, index) =>
              ({
                annotation,
                index,
                kind: "annotation" as const,
              }) satisfies CommentaryFeedItem,
          )
          .sort((left, right) => right.annotation.source_id - left.annotation.source_id)
      : events
          .map(
            (event) =>
              ({
                event,
                kind: "event" as const,
                minute: minuteValue(event.minuteLabel),
              }) satisfies CommentaryFeedItem,
          )
          .sort((left, right) => right.minute - left.minute);
  const fallbackCardTone = annotationTone("gold");

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
        {commentaryFeed.length === 0 ? (
          <TerminalState
            icon={MessageSquareDashed}
            title="No commentary yet"
            description="AI commentary will appear here after the annotation service receives match-state signals."
            tone="gold"
            className="m-4 min-h-[12rem]"
          />
        ) : (
          commentaryFeed.map((feedItem) => {
            if (feedItem.kind === "annotation") {
              const item = feedItem.annotation;
              const itemId = annotationId(item);
              const hasIcon = Boolean(item.icon?.trim());
              const itemTone = annotationTone(item.color);
              const itemKey = [
                feedItem.kind,
                itemId,
                item.id ?? item.source_seconds ?? item.minute ?? "live",
                item.type,
                item.text ?? "",
              ].join("-");

              return (
                <article
                  key={itemKey}
                  className={cn(
                    "border-l-4 border-b border-[var(--terminal-line)] px-4 py-3 font-mono uppercase last:border-b-0",
                    itemTone,
                    selectedEventId === itemId && "bg-[var(--terminal-hover)]",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                      {hasIcon ? (
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-current bg-black/10">
                          <AnnotationGlyph action={item.action} icon={item.icon} className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-[0.76rem] font-semibold text-[var(--terminal-text-strong)]">
                          {item.action ? item.action.replace(/_/g, " ") : "UPDATE"}
                        </p>
                        <p className="mt-1 text-[0.62rem] text-[var(--terminal-blue)]">
                          {item.minute !== undefined && item.minute !== null ? `${item.minute}'` : "--'"} / {item.team ?? "market"}
                        </p>
                      </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[0.68rem] leading-6 text-[var(--terminal-text)]">
                    {item.text ?? item.reason ?? item.outcome ?? "Market-state annotation received."}
                  </p>
                </article>
              );
            }

            const event = feedItem.event;
            return (
              <article
                key={event.eventId}
                className={cn(
                  "border-l-4 border-b border-[var(--terminal-line)] px-4 py-3 font-mono uppercase last:border-b-0",
                  fallbackCardTone,
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
                  <span className={cn("shrink-0 border px-2 py-0.5 text-[0.54rem] font-semibold", fallbackCardTone)}>
                    {event.type.replace(/-/g, " ")}
                  </span>
                </div>
                <p className="mt-3 text-[0.68rem] leading-6 text-[var(--terminal-text)]">
                  {eventCommentary(event)}
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
