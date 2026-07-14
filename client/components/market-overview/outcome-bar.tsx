"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "flat";

interface SegmentProps {
  label: string;
  value: number;
  prevValue?: number;
  bgClass: string;
  textClass: string;
}

function OutcomeSegment({ label, value, prevValue, bgClass, textClass }: SegmentProps) {
  const [trend, setTrend] = useState<Trend>("flat");
  const [delta, setDelta] = useState<number>(0);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (prevValue === undefined || prevValue === value) return;

    const diff = value - prevValue;
    if (Math.abs(diff) < 0.05) return;

    setDelta(diff);
    setTrend(diff > 0 ? "up" : "down");
    setShowIndicator(true);

    const timer = setTimeout(() => {
      setShowIndicator(false);
      setTrend("flat");
    }, 2800);

    return () => clearTimeout(timer);
  }, [value, prevValue]);

  const formattedDelta = delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "";
  const isNarrow = value < 12;

  return (
    <motion.div
      className={cn(
        "group relative flex shrink-0 items-center justify-center font-mono text-[0.72rem] font-semibold overflow-hidden",
        bgClass,
        textClass,
      )}
      style={{ minWidth: value > 0 ? "3.5rem" : undefined }}
      initial={false}
      animate={{ flex: `${value} 0 0%` }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      title={`${label}: ${value.toFixed(1)}%${formattedDelta ? ` (${formattedDelta})` : ""}`}
    >
      <div className="flex items-center gap-1 whitespace-nowrap">
        {/* percentage label — always visible */}
        <span>{value.toFixed(1)}%</span>

        {/* Trend indicator — inline next to text */}
        <AnimatePresence mode="wait">
          {showIndicator && trend !== "flat" && (
            <motion.span
              key={`${trend}-${delta}`}
              initial={{ opacity: 0, scale: 0.7, x: -4 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7, x: 4 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex items-center opacity-80"
            >
              <span className="text-[0.75rem]">{trend === "up" ? "↑" : "↓"}</span>
              <span className="text-[0.65rem]">{formattedDelta}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function MarketPending() {
  return (
    <div className="flex h-7 w-full items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400/80" />
        </span>
        <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em] text-[var(--terminal-text-muted)]">
          Market Pending
        </span>
      </div>
    </div>
  );
}

export function OutcomeBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  const prevRef = useRef<{ home: number; draw: number; away: number } | undefined>(undefined);

  useEffect(() => {
    prevRef.current = { home, draw, away };
  }, [home, draw, away]);

  const prev = prevRef.current;

  // No odds available — show pending state
  const hasOdds = home > 0 || draw > 0 || away > 0;
  if (!hasOdds) {
    return <MarketPending />;
  }

  return (
    <div className="relative flex h-7 w-full overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <OutcomeSegment
        label="Home"
        value={home}
        prevValue={prev?.home}
        bgClass="bg-[var(--prob-home)]"
        textClass="text-[#061009]"
      />
      <OutcomeSegment
        label="Draw"
        value={draw}
        prevValue={prev?.draw}
        bgClass="bg-[var(--prob-draw)]"
        textClass="text-[#071018]"
      />
      <OutcomeSegment
        label="Away"
        value={away}
        prevValue={prev?.away}
        bgClass="bg-[var(--prob-away)]"
        textClass="text-[#15090d]"
      />
    </div>
  );
}
