import type { MatchEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

import { eventCommentary, eventTone } from "./event-formatting";

export function CommentaryContent({
  events,
  selectedEventId,
}: {
  events: MatchEvent[];
  selectedEventId: string | null;
}) {
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
