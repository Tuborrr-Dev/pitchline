"use client";

import { AlertTriangle, SearchX } from "lucide-react";
import { motion } from "motion/react";

import { TerminalState } from "@/components/terminal-state";

import { panelMotion } from "./constants";
import { MarketGrid } from "./market-grid";
import { MarketCompactList, MarketTable } from "./market-list";
import type { MarketOverviewRow, MarketTab, ViewMode } from "./types";

export function MarketPanel({
  activeTab,
  effectiveViewMode,
  isError,
  isInitialLoading,
  hasSearchQuery,
  rows,
}: {
  activeTab: MarketTab;
  effectiveViewMode: ViewMode;
  isError: boolean;
  isInitialLoading: boolean;
  hasSearchQuery: boolean;
  rows: MarketOverviewRow[];
}) {
  return (
    <section className="px-3 py-5 sm:px-4">
      <div className="overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
        {isError ? (
          <ErrorPanel />
        ) : isInitialLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyPanel activeTab={activeTab} hasSearchQuery={hasSearchQuery} />
        ) : effectiveViewMode === "grid" ? (
          <MarketGrid rows={rows} />
        ) : (
          <>
            <div className="xl:hidden">
              <MarketCompactList rows={rows} />
            </div>
            <div className="hidden xl:block">
              <MarketTable rows={rows} />
            </div>
          </>
        )}

      </div>
    </section>
  );
}

function EmptyPanel({
  activeTab,
  hasSearchQuery,
}: {
  activeTab: MarketTab;
  hasSearchQuery: boolean;
}) {
  return (
    <motion.div key="empty" {...panelMotion} className="border-t border-[var(--terminal-line)] px-4 py-10">
      <TerminalState
        icon={SearchX}
        title={hasSearchQuery ? "No markets match search" : activeTab === "history" ? "No settled markets" : "No active markets"}
        description={hasSearchQuery ? "Adjust the search term or clear the filter to return to the full market list." : activeTab === "history" ? "Completed fixtures will appear here after markets settle." : "Live fixtures will appear here as soon as the market feed returns active rows."}
        className="mx-auto min-h-[12rem] max-w-2xl border-0 bg-transparent"
      />
    </motion.div>
  );
}

function ErrorPanel() {
  return (
    <motion.div
      key="error"
      {...panelMotion}
      className="flex min-h-[18rem] flex-col items-center justify-center gap-3 border-t border-[var(--terminal-line)] px-4 py-10 text-center font-mono uppercase"
    >
      <TerminalState
        icon={AlertTriangle}
        title="Market feed unavailable"
        description="The market endpoint failed validation or could not be reached. Existing rows will return when the feed recovers."
        tone="danger"
        className="min-h-[16rem] border-0 bg-transparent"
      />
    </motion.div>
  );
}

function LoadingRows() {
  return (
    <motion.div key="loading" {...panelMotion} className="space-y-0">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: index * 0.05 }}
          className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-t border-[var(--terminal-line)] px-4 py-4"
        >
          <div className="h-5 w-10 animate-pulse bg-[var(--terminal-hover)]" />
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse bg-[var(--terminal-hover)]" />
            <div className="h-3 w-36 animate-pulse bg-[var(--terminal-hover)]" />
          </div>
          <div className="mx-auto h-4 w-12 animate-pulse bg-[var(--terminal-hover)]" />
          <div className="mx-4 h-7 animate-pulse bg-[var(--terminal-hover)]" />
          <div className="ml-auto h-4 w-16 animate-pulse bg-[var(--terminal-hover)]" />
          <div className="ml-auto h-8 w-16 animate-pulse bg-[var(--terminal-hover)]" />
        </motion.div>
      ))}
    </motion.div>
  );
}
