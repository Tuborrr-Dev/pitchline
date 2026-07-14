import type { ProbabilityPoint } from "@/lib/types";

import { formatTimestamp } from "./chart-utils";

export function ChartHeader({
  inspectedPoint,
  teamACode,
  teamADelta,
  teamBCode,
  teamBDelta,
}: {
  inspectedPoint: ProbabilityPoint | null;
  teamACode: string;
  teamADelta: number;
  teamBCode: string;
  teamBDelta: number;
}) {
  return (
    <div className="grid gap-0 border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] md:grid-cols-[1fr_auto]">
      <div className="flex overflow-x-auto border-b border-[var(--terminal-border)] [scrollbar-width:none] [-ms-overflow-style:none] md:grid md:grid-cols-4 md:overflow-visible md:border-b-0 [&::-webkit-scrollbar]:hidden">
        <Metric label="Focus" value={inspectedPoint?.minuteLabel ?? "--"} detail={inspectedPoint ? formatTimestamp(inspectedPoint.timestamp) : "Waiting"} />
        <Metric label={`${teamACode} Equity`} value={inspectedPoint ? `${inspectedPoint.teamA.toFixed(1)}%` : "--"} detail={`Live move ${teamADelta >= 0 ? "+" : ""}${teamADelta.toFixed(1)}%`} tone="home" />
        <Metric label={`${teamBCode} Equity`} value={inspectedPoint ? `${inspectedPoint.teamB.toFixed(1)}%` : "--"} detail={`Live move ${teamBDelta >= 0 ? "+" : ""}${teamBDelta.toFixed(1)}%`} tone="away" />
        <Metric label="Draw / Parity" value={inspectedPoint ? `${inspectedPoint.draw.toFixed(1)}%` : "--"} detail="Market reserve" tone="draw" last />
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase md:flex md:min-w-[16rem]">
        <span className="text-[var(--terminal-green)]">{teamACode} Equity</span>
        <span className="text-[#ff4b6e]">{teamBCode} Equity</span>
        <span className="text-[#10a2cc]">VIX</span>
      </div>
    </div>
  );
}

function Metric({
  detail,
  label,
  last = false,
  tone,
  value,
}: {
  detail: string;
  label: string;
  last?: boolean;
  tone?: "home" | "away" | "draw";
  value: string;
}) {
  const labelClass =
    tone === "home"
      ? "text-[var(--terminal-green)]"
      : tone === "away"
        ? "text-[#ff4b6e]"
        : tone === "draw"
          ? "text-[#7faeca]"
          : "text-[var(--terminal-text-muted)]";
  const detailClass =
    tone === "home"
      ? "text-[var(--terminal-green)]"
      : tone === "away"
        ? "text-[#ff8aa2]"
        : tone === "draw"
          ? "text-[var(--terminal-blue)]"
          : "text-[var(--terminal-text-muted)]";

  return (
    <div className={`${last ? "" : "border-r border-[var(--terminal-border)]"} min-w-[7rem] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0`}>
      <p className={`font-mono text-[0.56rem] font-semibold uppercase sm:text-[0.64rem] ${labelClass}`}>{label}</p>
      <p className="font-display text-[1.05rem] font-bold uppercase text-[var(--terminal-text-strong)] sm:text-[1.45rem]">
        {value}
      </p>
      <p className={`font-mono text-[0.58rem] uppercase sm:text-[0.68rem] ${detailClass}`}>{detail}</p>
    </div>
  );
}
