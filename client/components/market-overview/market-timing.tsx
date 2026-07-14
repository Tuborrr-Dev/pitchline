import { cn } from "@/lib/utils";

import type { MarketOverviewRow } from "./types";
import { isUpcomingRow } from "./utils";

export function MarketTiming({ row, compact = false }: { row: MarketOverviewRow; compact?: boolean }) {
  if (isUpcomingRow(row)) {
    return (
      <>
        <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.35rem]" : "text-[1.15rem]")}>
          Kickoff
        </p>
        <p className={cn("font-mono uppercase text-[var(--terminal-text-muted)]", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
          {row.timeLabel}
        </p>
      </>
    );
  }

  return (
    <>
      <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.8rem]" : "text-[1.25rem]")}>
        {row.scoreLine}
      </p>
      <p className={cn("font-mono uppercase text-[var(--terminal-text-muted)]", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
        {row.timeLabel}
      </p>
    </>
  );
}
