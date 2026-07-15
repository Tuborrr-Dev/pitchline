"use client";

import { MatchCountdownTimer } from "@/components/match-countdown-timer";
import { cn } from "@/lib/utils";

import type { MarketOverviewRow } from "./types";
import { isUpcomingRow } from "./utils";

export function MarketTiming({ row, compact = false }: { row: MarketOverviewRow; compact?: boolean }) {
  const kickoffUtc = row.fixture?.kickoffUtc ?? new Date().toISOString();
  const status = row.fixture?.status ?? (isUpcomingRow(row) ? "upcoming" : "live");
  const phase = row.fixture?.phase;
  const minute = row.fixture?.minute;

  if (isUpcomingRow(row)) {
    return (
      <div className="flex flex-col items-center">
        <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.2rem]" : "text-[1.1rem]")}>
          Kickoff
        </p>
        <div className={cn("mt-0.5 font-mono uppercase", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
          <MatchCountdownTimer
            kickoffUtc={kickoffUtc}
            status={status}
            variant="compact"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.8rem]" : "text-[1.25rem]")}>
        {row.scoreLine}
      </p>
      <div className={cn("mt-0.5 font-mono uppercase", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
        <MatchCountdownTimer
          kickoffUtc={kickoffUtc}
          status={status}
          phase={phase}
          minute={minute}
          variant="badge"
        />
      </div>
    </div>
  );
}

