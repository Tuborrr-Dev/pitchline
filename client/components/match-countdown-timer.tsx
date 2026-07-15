"use client";

import { Clock, Radio } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export interface MatchCountdownTimerProps {
  kickoffUtc: string;
  status: string;
  phase?: string | null;
  minute?: string | null;
  variant?: "compact" | "badge" | "detailed";
  className?: string;
}

interface TimeRemaining {
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function calculateTimeRemaining(kickoffUtc: string): TimeRemaining {
  const kickoffTime = new Date(kickoffUtc).getTime();
  const now = Date.now();
  const totalSeconds = Math.max(0, Math.floor((kickoffTime - now) / 1000));

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    totalSeconds,
    days,
    hours,
    minutes,
    seconds,
    isPast: kickoffTime <= now,
  };
}

export function MatchCountdownTimer({
  kickoffUtc,
  status,
  phase,
  minute,
  variant = "compact",
  className,
}: MatchCountdownTimerProps) {
  const [remaining, setRemaining] = useState<TimeRemaining>(() => calculateTimeRemaining(kickoffUtc));
  const isLive = status === "live" || status === "IN_PLAY" || status === "1H" || status === "2H" || status === "HT";
  const isFinished = status === "finished" || status === "FT" || phase === "Finished" || phase === "FT";

  useEffect(() => {
    if (isFinished) return;

    const timer = setInterval(() => {
      setRemaining(calculateTimeRemaining(kickoffUtc));
    }, 1000);

    return () => clearInterval(timer);
  }, [kickoffUtc, isFinished]);

  if (isFinished) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-[var(--terminal-text-muted)]", className)}>
        <span className="font-semibold uppercase">FT</span>
      </span>
    );
  }

  if (isLive) {
    const displayLabel = [phase, minute].filter(Boolean).join(" · ") || "LIVE";

    if (variant === "badge") {
      return (
        <span className={cn("inline-flex items-center gap-2 rounded-full border border-[var(--terminal-green)] bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[0.7rem] font-bold text-[var(--terminal-green)]", className)}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--terminal-green)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--terminal-green)]" />
          </span>
          {displayLabel}
        </span>
      );
    }

    return (
      <div className={cn("inline-flex items-center gap-2 font-mono text-[var(--terminal-green)] font-semibold", className)}>
        <motion.span
          animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex items-center justify-center"
        >
          <Radio className="h-3.5 w-3.5" />
        </motion.span>
        <span>{displayLabel}</span>
      </div>
    );
  }

  // Pre-kickoff upcoming countdown
  const { days, hours, minutes, seconds, isPast } = remaining;

  if (isPast) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-amber-600 dark:text-amber-400 font-bold", className)}>
        <Clock className="h-3.5 w-3.5" />
        <span>Starting Soon</span>
      </span>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (variant === "detailed") {
    return (
      <div className={cn("flex items-center gap-2 font-mono text-xs text-[var(--terminal-green)]", className)}>
        <Clock className="h-4 w-4 text-[var(--terminal-green)]" />
        <span className="uppercase tracking-wider text-[0.65rem] text-[var(--terminal-text-muted)]">Kickoff in</span>
        <div className="flex items-center gap-1 font-bold text-[var(--terminal-text-strong)]">
          {days > 0 && <span>{days}d </span>}
          <span>{pad(hours)}h</span>:<span>{pad(minutes)}m</span>:
          <motion.span key={seconds} animate={{ scale: [1.15, 1] }} transition={{ duration: 0.2 }}>
            {pad(seconds)}s
          </motion.span>
        </div>
      </div>
    );
  }

  if (variant === "badge") {
    let text = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    if (days > 0) {
      text = `${days}d ${pad(hours)}h`;
    }

    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[var(--terminal-blue)] bg-sky-500/10 dark:bg-sky-400/10 px-2.5 py-0.5 font-mono text-[0.72rem] font-bold text-[var(--terminal-blue)]", className)}>
        <Clock className="h-3 w-3" />
        <span>T-{text}</span>
      </span>
    );
  }

  // Compact variant
  let timeStr = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (days > 0) {
    timeStr = `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 font-mono text-[var(--terminal-text-strong)]", className)}>
      <Clock className="h-3.5 w-3.5 text-[var(--terminal-blue)]" />
      <span className="font-bold">{timeStr}</span>
    </div>
  );
}


