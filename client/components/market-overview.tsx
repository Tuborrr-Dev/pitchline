"use client";

import { useQuery } from "@tanstack/react-query";
import { useAnimationFrame } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { MarketHeader } from "@/components/market-overview/market-header";
import { MarketPanel } from "@/components/market-overview/market-panel";
import { MarketTicker } from "@/components/market-overview/market-ticker";
import type { MarketOverviewRow, MarketTab, ViewMode } from "@/components/market-overview/types";
import { useMarketOverviewStream } from "@/hooks/use-market-overview-stream";
import {
  finishedMarketOverviewQueryOptions,
  marketOverviewQueryOptions,
} from "@/queries/market-queries";

export function MarketOverview({
  initialRows,
  initialTab = "markets",
}: {
  initialRows: MarketOverviewRow[];
  initialTab?: MarketTab;
}) {
  const activeTab = initialTab;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isMobile, setIsMobile] = useState(false);
  const tickerRef = useRef<HTMLDivElement | null>(null);
  const tickerPauseUntilRef = useRef(0);
  const searchParams = useSearchParams();
  const deferredQuery = useDeferredValue(searchParams.get("q") ?? "");

  const {
    data: fetchedActiveRows = activeTab === "markets" ? initialRows : [],
    isError: isMarketsError,
    isFetching: isMarketsFetching,
  } = useQuery({
    ...marketOverviewQueryOptions(activeTab === "markets" ? initialRows : undefined),
    enabled: activeTab === "markets",
  });
  const streamedActiveRows = useMarketOverviewStream(fetchedActiveRows, activeTab === "markets");
  const {
    data: finishedRows = [],
    isError: isFinishedError,
    isFetching: isFinishedFetching,
  } = useQuery({
    ...finishedMarketOverviewQueryOptions(activeTab === "history" ? initialRows : undefined),
    enabled: activeTab === "history",
  });

  const rows = activeTab === "history" ? finishedRows : streamedActiveRows;
  const isError = activeTab === "history" ? isFinishedError : isMarketsError;
  const isFetching = activeTab === "history" ? isFinishedFetching : isMarketsFetching;
  const isInitialLoading = isFetching && rows.length === 0;
  const hasSearchQuery = deferredQuery.trim().length > 0;

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return rows;
    return rows.filter((row) =>
      [row.eventPair, row.eventSubLabel, row.statusLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [deferredQuery, rows]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 639px)");

    const syncBreakpoints = () => {
      setIsMobile(mobileQuery.matches);
    };

    syncBreakpoints();
    mobileQuery.addEventListener("change", syncBreakpoints);

    return () => {
      mobileQuery.removeEventListener("change", syncBreakpoints);
    };
  }, []);

  useEffect(() => {
    const ticker = tickerRef.current;
    if (!ticker || !isMobile) return;

    const pauseAutoScroll = () => {
      tickerPauseUntilRef.current = window.performance.now() + 1800;
    };

    ticker.addEventListener("touchstart", pauseAutoScroll, { passive: true });
    ticker.addEventListener("touchmove", pauseAutoScroll, { passive: true });
    ticker.addEventListener("pointerdown", pauseAutoScroll, { passive: true });
    ticker.addEventListener("wheel", pauseAutoScroll, { passive: true });

    return () => {
      ticker.removeEventListener("touchstart", pauseAutoScroll);
      ticker.removeEventListener("touchmove", pauseAutoScroll);
      ticker.removeEventListener("pointerdown", pauseAutoScroll);
      ticker.removeEventListener("wheel", pauseAutoScroll);
    };
  }, [isMobile]);

  useAnimationFrame((time, delta) => {
    const ticker = tickerRef.current;
    if (!ticker || !isMobile) return;

    const halfWidth = ticker.scrollWidth / 2;
    if (halfWidth <= 0) return;
    if (time < tickerPauseUntilRef.current) return;

    ticker.scrollLeft += delta * 0.1;
    if (ticker.scrollLeft >= halfWidth) {
      ticker.scrollLeft -= halfWidth;
    }
  });

  const effectiveViewMode = isMobile ? "grid" : viewMode;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    try {
      sessionStorage.setItem(`pitchline_scroll_${activeTab}`, container.scrollTop.toString());
    } catch {
      // Ignore storage errors
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    try {
      const savedScroll = sessionStorage.getItem(`pitchline_scroll_${activeTab}`);
      if (!savedScroll) return;

      const targetScroll = Number(savedScroll);
      if (Number.isNaN(targetScroll) || targetScroll <= 0) return;

      container.scrollTop = targetScroll;
      const t1 = setTimeout(() => { if (container) container.scrollTop = targetScroll; }, 40);
      const t2 = setTimeout(() => { if (container) container.scrollTop = targetScroll; }, 160);
      const t3 = setTimeout(() => { if (container) container.scrollTop = targetScroll; }, 360);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } catch {
      // Ignore storage errors
    }
  }, [activeTab, filteredRows.length]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto bg-[var(--background)] pb-20 text-[var(--terminal-text)]"
    >
      <main className="w-full overflow-hidden bg-[var(--terminal-bg)]">
        <MarketHeader
          activeTab={activeTab}
          deferredQuery={deferredQuery}
          effectiveViewMode={effectiveViewMode}
          filteredCount={filteredRows.length}
          isFetching={isFetching}
          isMobile={isMobile}
          setViewMode={setViewMode}
          viewMode={viewMode}
        />
        <MarketPanel
          activeTab={activeTab}
          effectiveViewMode={effectiveViewMode}
          isError={isError}
          isInitialLoading={isInitialLoading}
          hasSearchQuery={hasSearchQuery}
          rows={filteredRows}
        />
        <MarketTicker tickerRef={tickerRef} />
      </main>
    </div>
  );
}
