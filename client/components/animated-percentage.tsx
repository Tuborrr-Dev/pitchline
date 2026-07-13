"use client";

import { animate, motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface AnimatedPercentageProps {
  value: number;
  className?: string;
  showDeltaBadge?: boolean;
  showSymbol?: boolean;
  decimals?: number;
}

export function AnimatedPercentage({
  value,
  className,
  showDeltaBadge = false,
  showSymbol = true,
  decimals = 1,
}: AnimatedPercentageProps) {
  const count = useMotionValue(value);
  const [displayFormatted, setDisplayFormatted] = useState<string>(value.toFixed(decimals));
  const [tickDirection, setTickDirection] = useState<"up" | "down" | null>(null);
  const previousValueRef = useRef(value);
  const tickTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const prev = previousValueRef.current;
    if (Math.abs(prev - value) > 0.01) {
      const direction = value > prev ? "up" : "down";
      setTickDirection(direction);

      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
      tickTimerRef.current = setTimeout(() => {
        setTickDirection(null);
      }, 1400);
    }

    previousValueRef.current = value;

    const controls = animate(count, value, {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setDisplayFormatted(latest.toFixed(decimals));
      },
    });

    return () => {
      controls.stop();
      if (tickTimerRef.current) clearTimeout(tickTimerRef.current);
    };
  }, [value, count, decimals]);

  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-1 transition-colors duration-300",
        tickDirection === "up" && "text-(--terminal-green) drop-shadow-[0_0_8px_rgba(25,239,140,0.4)]",
        tickDirection === "down" && "text-[#ff4b6e] drop-shadow-[0_0_8px_rgba(255,75,110,0.4)]",
        className,
      )}
    >
      <span>
        {displayFormatted}
        {showSymbol ? "%" : ""}
      </span>
      {showDeltaBadge && tickDirection ? (
        <motion.span
          initial={{ opacity: 0, scale: 0.6, y: tickDirection === "up" ? 3 : -3 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "font-mono text-[0.62em] font-bold uppercase",
            tickDirection === "up" ? "text-(--terminal-green)" : "text-[#ff4b6e]",
          )}
        >
          {tickDirection === "up" ? "▲" : "▼"}
        </motion.span>
      ) : null}
    </motion.span>
  );
}
