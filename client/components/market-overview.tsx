"use client";

import { useQuery } from "@tanstack/react-query";
import { useAnimationFrame } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { MarketHeader } from "@/components/market-overview/market-header";
import { MarketPanel } from "@/components/market-overview/market-panel";
import { MarketTicker } from "@/components/market-overview/market-ticker";
import { useMarketOverviewStream } from "@/hooks/use-market-overview-stream";
import type { MarketOverviewRow, MarketTab, ViewMode } from "@/components/market-overview/types";
import {
  finishedMarketOverviewQueryOptions,
  marketOverviewQueryOptions,
} from "@/queries/market-queries";

export function MarketOverview({ initialRows }: { initialRows: MarketOverviewRow[] }) {
  const [activeTab, setActiveTab] = useState<MarketTab>("markets");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktopTable, setIsDesktopTable] = useState(false);
  const tickerRef = useRef<HTMLDivElement | null>(null);
  const tickerPauseUntilRef = useRef(0);
  const searchParams = useSearchParams();
  const deferredQuery = useDeferredValue(searchParams.get("q") ?? "");

  const { data: fetchedActiveRows = initialRows, isError: isMarketsError, isFetching: isMarketsFetching } = useQuery(
    marketOverviewQueryOptions(initialRows),
  );
  const streamedActiveRows = useMarketOverviewStream(fetchedActiveRows, activeTab === "markets");
  const { data: finishedRows = [], isError: isFinishedError, isFetching: isFinishedFetching } = useQuery({
    ...finishedMarketOverviewQueryOptions(),
    enabled: activeTab === "history",
  });

  const rows = activeTab === "history" ? finishedRows : streamedActiveRows;
  const isError = activeTab === "history" ? isFinishedError : isMarketsError;
  const isFetching = activeTab === "history" ? isFinishedFetching : isMarketsFetching;
  const isInitialLoading = isFetching && rows.length === 0;

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
    const desktopTableQuery = window.matchMedia("(min-width: 1280px)");

    const syncBreakpoints = () => {
      setIsMobile(mobileQuery.matches);
      setIsDesktopTable(desktopTableQuery.matches);
    };

    syncBreakpoints();
    mobileQuery.addEventListener("change", syncBreakpoints);
    desktopTableQuery.addEventListener("change", syncBreakpoints);

    return () => {
      mobileQuery.removeEventListener("change", syncBreakpoints);
      desktopTableQuery.removeEventListener("change", syncBreakpoints);
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

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] pb-20 text-[var(--terminal-text)]">
      <main className="w-full overflow-hidden bg-[var(--terminal-bg)]">
        <MarketHeader
          activeTab={activeTab}
          deferredQuery={deferredQuery}
          effectiveViewMode={effectiveViewMode}
          filteredCount={filteredRows.length}
          isFetching={isFetching}
          isMobile={isMobile}
          setActiveTab={setActiveTab}
          setViewMode={setViewMode}
          viewMode={viewMode}
        />
        <MarketPanel
          activeTab={activeTab}
          effectiveViewMode={effectiveViewMode}
          isDesktopTable={isDesktopTable}
          isError={isError}
          isInitialLoading={isInitialLoading}
          rows={filteredRows}
        />
        <MarketTicker tickerRef={tickerRef} />
      </main>
    </div>
  );
}
