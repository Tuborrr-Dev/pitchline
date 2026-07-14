"use client";

import { AnimatePresence, motion } from "motion/react";

import type { ConnectionState } from "@/lib/types";

export function FeedStatusBadge({ connectionState }: { connectionState: ConnectionState }) {
  return (
    <AnimatePresence>
      {connectionState !== "live" ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16 }}
          className="pointer-events-none absolute left-4 top-4 z-30 border border-[var(--signal)] bg-yellow-500/10 px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase text-[#a37200]"
        >
          {connectionState === "connecting"
            ? "Connecting feed"
            : connectionState === "reconnecting"
              ? "Reconnecting feed"
              : "Feed paused"}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
