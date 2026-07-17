import { MessageSquareDashed } from "lucide-react";

import { TerminalState } from "@/components/terminal-state";
import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AnnotationGlyph, annotationId, annotationTone } from "./annotation-ui";

type CommentaryFeedItem =
  { annotation: Annotation; index: number; kind: "annotation" };

export function CommentaryContent({
  annotations = [],
  selectedEventId,
}: {
  annotations?: Annotation[];
  selectedEventId: string | null;
}) {
  const commentaryFeed: CommentaryFeedItem[] =
    annotations
      .map(
        (annotation, index) =>
          ({
            annotation,
            index,
            kind: "annotation" as const,
          }) satisfies CommentaryFeedItem,
      )
      .sort((left, right) => right.annotation.source_id - left.annotation.source_id);

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
          })
        )}
      </div>
    </section>
  );
}
