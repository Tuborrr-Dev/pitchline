"use client";

import Link from "next/link";

import { TeamLogo } from "@/components/team-logo";

import { MarketTiming } from "./market-timing";
import { OutcomeBar } from "./outcome-bar";
import { StatusBadge } from "./status-badge";
import type { MarketOverviewRow } from "./types";
import { cleanLabel, rowHref } from "./utils";

export function MarketGrid({ rows }: { rows: MarketOverviewRow[] }) {
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3">
      {rows.map((row) => (
        <Link
          key={row.fixture.fixtureId}
          href={rowHref(row)}
          className="block cursor-pointer border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-4 transition hover:border-[var(--terminal-green)] hover:bg-[var(--terminal-hover)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2.5">
                <TeamLogo code={row.fixture.teamACode} name={row.fixture.teamAName} size="sm" />
                <span className="font-display text-[1.45rem] font-bold uppercase text-[var(--terminal-text-strong)]">
                  {row.fixture.teamACode}
                </span>
                <span className="font-mono text-xs font-normal text-[var(--muted)]">VS</span>
                <span className="font-display text-[1.45rem] font-bold uppercase text-[var(--terminal-text-strong)]">
                  {row.fixture.teamBCode}
                </span>
                <TeamLogo code={row.fixture.teamBCode} name={row.fixture.teamBName} size="sm" />
              </div>
              <p className="mt-1 font-mono text-[0.7rem] uppercase text-[var(--muted)]">
                {cleanLabel(row.eventSubLabel)}
              </p>
            </div>
            <StatusBadge row={row} />
          </div>
          <div className="mt-5">
            <MarketTiming row={row} compact />
          </div>
          <div className="mt-4">
            <OutcomeBar home={row.probabilities.home} draw={row.probabilities.draw} away={row.probabilities.away} />
          </div>
        </Link>
      ))}
    </div>
  );
}

