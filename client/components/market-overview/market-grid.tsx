"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { MarketTiming } from "./market-timing";
import { OutcomeBar } from "./outcome-bar";
import { StatusBadge } from "./status-badge";
import type { MarketOverviewRow } from "./types";
import { cleanLabel, rowHref } from "./utils";

export function MarketGrid({ rows }: { rows: MarketOverviewRow[] }) {
  return (
    <motion.div layout className="grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {rows.map((row) => (
          <motion.div
            key={row.fixture.fixtureId}
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <Link href={rowHref(row)} className="block cursor-pointer border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-4 transition hover:border-[var(--terminal-green)] hover:bg-[var(--terminal-hover)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[1.45rem] font-bold uppercase text-[var(--terminal-text-strong)]">
                    {row.eventPair}
                  </p>
                  <p className="mt-1 font-mono text-[0.7rem] uppercase text-[var(--muted)]">
                    {cleanLabel(row.eventSubLabel)}
                  </p>
                </div>
                <StatusBadge row={row} />
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <MarketTiming row={row} compact />
                </div>
                <div className="text-right">
                  <p className="font-display text-[1.5rem] font-bold text-[var(--terminal-text-strong)]">{row.liquidity}</p>
                  <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-green)]">Depth {row.depth}</p>
                </div>
              </div>
              <div className="mt-4">
                <OutcomeBar home={row.probabilities.home} draw={row.probabilities.draw} away={row.probabilities.away} />
              </div>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
