"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { Annotation } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AnnotationGlyph, annotationId, annotationTone } from "./annotation-ui";

const TOAST_DURATION_MS = 5000;

function newestAnnotation(annotations: Annotation[]) {
  return [...annotations].sort((left, right) => {
    const sourceDelta = right.source_id - left.source_id;
    if (sourceDelta !== 0) return sourceDelta;
    return (right.minute ?? 0) - (left.minute ?? 0);
  })[0] ?? null;
}

function CommentaryToastCard({ annotation }: { annotation: Annotation }) {
  const tone = annotationTone(annotation.color);
  const hasIcon = Boolean(annotation.icon?.trim());

  return (
    <motion.article
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "pointer-events-auto relative z-[90] border-l-4 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-3 font-mono uppercase shadow-[0_18px_45px_rgba(0,0,0,0.35)]",
        tone,
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2">
        {hasIcon ? (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-current bg-black/10">
            <AnnotationGlyph action={annotation.action} icon={annotation.icon} className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[0.76rem] font-semibold text-[var(--terminal-text-strong)]">
            {annotation.action ? annotation.action.replace(/_/g, " ") : "UPDATE"}
          </p>
          <p className="mt-1 text-[0.62rem] text-[var(--terminal-blue)]">
            {annotation.minute !== undefined && annotation.minute !== null ? `${annotation.minute}'` : "--'"} / {annotation.team ?? "market"}
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[0.68rem] leading-5 text-[var(--terminal-text)]">
        {annotation.text ?? annotation.reason ?? annotation.outcome ?? "Market-state annotation received."}
      </p>
    </motion.article>
  );
}

export function MobileCommentaryToast({
  annotations,
  enabled,
}: {
  annotations: Annotation[];
  enabled: boolean;
}) {
  const [visibleAnnotation, setVisibleAnnotation] = useState<Annotation | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(annotations.map(annotationId));
      return;
    }

    const unseen = annotations.filter((annotation) => !seenIdsRef.current?.has(annotationId(annotation)));
    annotations.forEach((annotation) => seenIdsRef.current?.add(annotationId(annotation)));

    const nextAnnotation = newestAnnotation(unseen);
    if (nextAnnotation) {
      setVisibleAnnotation(nextAnnotation);
    }
  }, [annotations, enabled]);

  useEffect(() => {
    if (!visibleAnnotation) return;

    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
    }

    dismissTimerRef.current = window.setTimeout(() => {
      setVisibleAnnotation(null);
      dismissTimerRef.current = null;
    }, TOAST_DURATION_MS);

    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [visibleAnnotation]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[120] isolate xl:hidden">
      <AnimatePresence mode="wait">
        {visibleAnnotation ? (
          <CommentaryToastCard key={annotationId(visibleAnnotation)} annotation={visibleAnnotation} />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
