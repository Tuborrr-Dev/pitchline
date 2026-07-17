"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { MarketHeader } from "@/components/market-overview/market-header";
import { MarketPanel } from "@/components/market-overview/market-panel";
import type { MarketOverviewRow, MarketTab, ViewMode } from "@/components/market-overview/types";
import { useMarketOverviewStream } from "@/hooks/use-market-overview-stream";
import {
  finishedMarketOverviewQueryOptions,
  marketOverviewQueryOptions,
} from "@/queries/market-queries";

const VIEW_MODE_STORAGE_KEY = "pitchline_market_overview_view_mode";
const viewModeListeners = new Set<() => void>();

function isViewMode(value: string | null): value is ViewMode {
  return value === "list" || value === "grid";
}

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "list" satisfies ViewMode;

  try {
    const storedViewMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return isViewMode(storedViewMode) ? storedViewMode : "list";
  } catch {
    return "list" satisfies ViewMode;
  }
}

function subscribeToViewMode(listener: () => void) {
  viewModeListeners.add(listener);
  return () => viewModeListeners.delete(listener);
}

function saveStoredViewMode(mode: ViewMode) {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors and keep the in-memory UI responsive.
  }

  viewModeListeners.forEach((listener) => listener());
}

export function MarketOverview({
  initialRows,
  initialTab = "markets",
}: {
  initialRows: MarketOverviewRow[];
  initialTab?: MarketTab;
}) {
  const activeTab = initialTab;
  const viewMode = useSyncExternalStore<ViewMode>(
    subscribeToViewMode,
    getStoredViewMode,
    () => "list" satisfies ViewMode,
  );
  const [optimisticViewMode, setOptimisticViewMode] = useState<ViewMode | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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

  const selectedViewMode = optimisticViewMode ?? viewMode;
  const effectiveViewMode: ViewMode = isMobile ? "grid" : selectedViewMode;
  const handleViewModeChange = (mode: ViewMode) => {
    setOptimisticViewMode(mode);
    saveStoredViewMode(mode);
  };
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
  }, [activeTab, rows.length]);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto bg-[var(--background)] text-[var(--terminal-text)]"
    >
      <main className="w-full overflow-hidden bg-[var(--terminal-bg)]">
        <MarketHeader
          activeTab={activeTab}
          effectiveViewMode={effectiveViewMode}
          filteredCount={rows.length}
          isFetching={isFetching}
          isMobile={isMobile}
          setViewMode={handleViewModeChange}
          viewMode={selectedViewMode}
        />
        <MarketPanel
          activeTab={activeTab}
          effectiveViewMode={effectiveViewMode}
          isError={isError}
          isInitialLoading={isInitialLoading}
          hasSearchQuery={false}
          rows={rows}
        />
      </main>
    </div>
  );
}

