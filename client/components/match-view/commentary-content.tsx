import type { Annotation, MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { eventCommentary, eventTone } from "./event-formatting";

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

function annotationBadge(type: Annotation["type"]) {
  if (type === "annotation") return "AI ANALYST";
  if (type === "update") return "UPDATED";
  return "LIVE FEED";
}

export function CommentaryContent({
  annotations = [],
  events,
  selectedEventId,
}: {
  annotations?: Annotation[];
  events: MatchEvent[];
  selectedEventId: string | null;
}) {
  const hasAnnotations = annotations.length > 0;
  const sortedAnnotations = [...annotations].reverse();
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
        {hasAnnotations
          ? sortedAnnotations.map((item) => (
              <article
                key={`${item.fixture_id}-${item.source_action}-${item.source_id}-${item.id}`}
                className={cn(
                  "border-b border-[var(--terminal-line)] px-4 py-3 font-mono uppercase last:border-b-0",
                  selectedEventId === `${item.fixture_id}-${item.source_action}-${item.source_id}` &&
                    "bg-[var(--terminal-hover)]",
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
                  <span className={cn("shrink-0 border px-2 py-0.5 text-[0.54rem] font-semibold", annotationTone(item.color))}>
                    {annotationBadge(item.type)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[0.68rem] leading-6 text-[var(--terminal-text)]">
                  {item.text}
                </p>
                {item.home_score !== null &&
                item.away_score !== null &&
                item.home_score !== undefined &&
                item.away_score !== undefined ? (
                  <p className="mt-2 font-mono text-[0.62rem] font-semibold text-[var(--terminal-text-muted)]">
                    SCORE: {item.home_score} - {item.away_score}
                  </p>
                ) : null}
              </article>
            ))
          : commentaryFeed.map((event) => (
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
                  <span className={cn("shrink-0 border px-2 py-0.5 text-[0.54rem] font-semibold", eventTone(event))}>
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
