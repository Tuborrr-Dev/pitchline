"use client";

import { motion } from "motion/react";

export function OutcomeBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="flex h-7 w-full overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-home)] font-mono text-[0.72rem] font-semibold text-[#061009]"
        initial={false}
        animate={{ width: `${home}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {home.toFixed(1)}%
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-draw)] font-mono text-[0.72rem] font-semibold text-[#071018]"
        initial={false}
        animate={{ width: `${draw}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {draw.toFixed(1)}%
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-away)] font-mono text-[0.72rem] font-semibold text-[#15090d]"
        initial={false}
        animate={{ width: `${away}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {away.toFixed(1)}%
      </motion.div>
    </div>
  );
}
