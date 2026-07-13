"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { MarketTiming } from "./market-timing";
import { OutcomeBar } from "./outcome-bar";
import { StatusBadge } from "./status-badge";
import type { MarketOverviewRow } from "./types";
import { cleanLabel, rowHref } from "./utils";

function MarketRow({ row }: { row: MarketOverviewRow }) {
  const href = rowHref(row);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-t border-[var(--terminal-line)] px-4 py-3 text-[var(--foreground)] transition hover:bg-[var(--terminal-hover)]"
    >
      <div className="flex items-center">
        <StatusBadge row={row} />
      </div>
      <div>
        <Link href={href} className="cursor-pointer font-display text-[1.25rem] font-bold uppercase text-[var(--terminal-text-strong)] transition hover:text-[var(--terminal-green)]">
          {row.eventPair}
        </Link>
        <p className="mt-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)]">
          {cleanLabel(row.eventSubLabel)}
        </p>
      </div>
      <div className="text-center">
        <MarketTiming row={row} />
      </div>
      <div className="px-4">
        <OutcomeBar home={row.probabilities.home} draw={row.probabilities.draw} away={row.probabilities.away} />
      </div>
      <div className="text-right">
        <p className="font-display text-[1.2rem] font-bold uppercase text-[var(--terminal-text-strong)]">{row.liquidity}</p>
        <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-green)]">Depth {row.depth}</p>
      </div>
      <div className="flex justify-end">
        <Button
          asChild
          className={cn(
            "h-8 min-w-[4.25rem] cursor-pointer rounded-none border px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
            row.actionTone === "primary"
              ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--terminal-inverse-fg)] hover:bg-[var(--terminal-green)]"
              : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:border-[var(--terminal-blue)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
          )}
        >
          <Link href={href}>{row.action}</Link>
        </Button>
      </div>
    </motion.div>
  );
}

function MarketCompactListRow({ row }: { row: MarketOverviewRow }) {
  const href = rowHref(row);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="border-t border-[var(--terminal-line)] px-4 py-4 transition hover:bg-[var(--terminal-hover)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge row={row} />
            <Link href={href} className="cursor-pointer font-display text-[1.55rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] transition hover:text-[var(--terminal-green)]">
              {row.eventPair}
            </Link>
          </div>
          <p className="mt-2 font-mono text-[0.72rem] uppercase text-[var(--muted)]">
            {cleanLabel(row.eventSubLabel)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <MarketTiming row={row} compact />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <OutcomeBar home={row.probabilities.home} draw={row.probabilities.draw} away={row.probabilities.away} />
        <div className="sm:text-right">
          <p className="font-display text-[1.45rem] font-bold leading-none text-[var(--terminal-text-strong)]">{row.liquidity}</p>
          <p className="mt-1 font-mono text-[0.72rem] uppercase text-[var(--terminal-green)]">Depth {row.depth}</p>
        </div>
        <div className="sm:justify-self-end">
          <Button
            asChild
            className={cn(
              "h-9 min-w-[5rem] cursor-pointer rounded-none border px-4 font-mono text-[0.72rem] font-semibold uppercase shadow-none",
              row.actionTone === "primary"
                ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--terminal-inverse-fg)] hover:bg-[var(--terminal-green)]"
                : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:border-[var(--terminal-blue)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
            )}
          >
            <Link href={href}>{row.action}</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function MarketTable({ rows }: { rows: MarketOverviewRow[] }) {
  return (
    <motion.div key="list">
      <div className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
        <div>Status</div>
        <div>Event / Pair</div>
        <div className="text-center">Score/Time</div>
        <div className="px-4">Outcome Probability (Home / Draw / Away)</div>
        <div className="text-right">Liquidity Depth</div>
        <div className="text-right">Action</div>
      </div>
      <AnimatePresence mode="popLayout">
        {rows.map((row) => (
          <MarketRow key={row.fixture.fixtureId} row={row} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function MarketCompactList({ rows }: { rows: MarketOverviewRow[] }) {
  return (
    <motion.div key="compact-list">
      <div className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
        <div>Status</div>
        <div>Event / Market</div>
        <div className="text-right">Score</div>
      </div>
      <AnimatePresence mode="popLayout">
        {rows.map((row) => (
          <MarketCompactListRow key={row.fixture.fixtureId} row={row} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
