import type { ConnectionState, MarketAnalyticsData } from "@/lib/types";
import type { getVisibleVixPoints } from "./chart-utils";

export function VixPanel({
  analytics,
  connectionState,
  visibleVixPoints,
}: {
  analytics?: MarketAnalyticsData;
  connectionState: ConnectionState;
  visibleVixPoints: ReturnType<typeof getVisibleVixPoints>;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 h-[5.5rem] border-t border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2 sm:h-[8rem] sm:px-4 sm:py-3">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="vix-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10a2cc" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#10a2cc" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="#10a2cc"
          strokeWidth="1.6"
          points={visibleVixPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          fill="url(#vix-fill)"
          points={`0,100 ${visibleVixPoints.map((point) => `${point.x},${point.y}`).join(" ")} 100,100`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-x-3 top-2 flex justify-between font-mono text-[0.54rem] font-semibold uppercase text-[#0f9ac3] sm:inset-x-4 sm:text-[0.62rem]">
        <span>VIX Max {analytics?.volatility ? `/ Volatility ${analytics.volatility.level}` : ""}</span>
        <span>
          {analytics?.momentum
            ? `Momentum: ${analytics.momentum.direction} (${analytics.momentum.slope > 0 ? "+" : ""}${analytics.momentum.slope})`
            : "Volatility shock index"}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between font-mono text-[0.54rem] font-semibold uppercase text-[#0f6c87] sm:inset-x-4 sm:text-[0.62rem]">
        <span>VIX Min {analytics?.volatility ? `(sigma ${analytics.volatility.stdDev})` : ""}</span>
        <span>{connectionState === "live" ? "Live feed stable" : connectionState}</span>
      </div>
    </div>
  );
}
