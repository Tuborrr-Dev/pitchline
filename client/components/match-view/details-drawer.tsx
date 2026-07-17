"use client";

import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import type { Annotation } from "@/lib/types";

import { CommentaryContent } from "./commentary-content";

export function DesktopDetailsPanel({
  annotations,
  open,
  selectedEventId,
}: {
  annotations?: Annotation[];
  open: boolean;
  selectedEventId: string | null;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
          className="hidden overflow-y-auto border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-4 xl:block xl:min-h-0 xl:border-l xl:border-t-0"
        >
          <CommentaryContent annotations={annotations} selectedEventId={selectedEventId} />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

export function MobileDetailsDrawer({
  annotations,
  onClose,
  open,
  prioritizeSelected = false,
  selectedEventId,
}: {
  annotations?: Annotation[];
  onClose: () => void;
  open: boolean;
  prioritizeSelected?: boolean;
  selectedEventId: string | null;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-40 cursor-pointer bg-black/45 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[72dvh] overflow-y-auto border-t border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-4 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] xl:hidden"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
                Commentary
              </p>
              <Button
                type="button"
                onClick={onClose}
                className="h-8 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-transparent px-3 font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)] shadow-none hover:bg-[var(--terminal-hover)]"
              >
                Close
              </Button>
            </div>
            <CommentaryContent annotations={annotations} prioritizeSelected={prioritizeSelected} selectedEventId={selectedEventId} />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
