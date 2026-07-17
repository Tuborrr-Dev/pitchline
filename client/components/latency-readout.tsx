"use client";

import { useQuery } from "@tanstack/react-query";

import { latencyQueryOptions } from "@/queries/latency-queries";
import { cn } from "@/lib/utils";

function formatLatency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${Math.round(value)}ms`;
}

export function LatencyReadout({ className }: { className?: string }) {
  const { data } = useQuery(latencyQueryOptions());

  return (
    <p className={cn("font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)]", className)}>
      Latency: {formatLatency(data?.avg_latency_ms)}
    </p>
  );
}
