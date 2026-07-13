import { cn } from "@/lib/utils";

import type { MarketOverviewRow } from "./types";

export function StatusBadge({ row }: { row: MarketOverviewRow }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border px-2 font-mono text-[0.68rem] font-semibold leading-none",
        row.status === "live"
          ? "border-[#135238] bg-[var(--prob-home)] text-[#041009]"
          : "border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text-strong)]",
      )}
    >
      {row.statusLabel}
    </span>
  );
}
