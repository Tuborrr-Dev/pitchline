"use client";

import { AlertTriangle, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { panelMotion } from "./constants";
import { MarketGrid } from "./market-grid";
import { MarketCompactList, MarketTable } from "./market-list";
import type { MarketOverviewRow, MarketTab, ViewMode } from "./types";

export function MarketPanel({
  activeTab,
  effectiveViewMode,
  isError,
  isInitialLoading,
  rows,
}: {
  activeTab: MarketTab;
  effectiveViewMode: ViewMode;
  isError: boolean;
  isInitialLoading: boolean;
  rows: MarketOverviewRow[];
}) {
  return (
    <section className="px-3 py-5 sm:px-4">
      <div className="overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
        <AnimatePresence mode="wait">
          {activeTab === "settings" ? (
            <SettingsPanel />
          ) : isError ? (
            <ErrorPanel />
          ) : isInitialLoading ? (
            <LoadingRows />
          ) : effectiveViewMode === "grid" ? (
            <motion.div key="grid" {...panelMotion}>
              <MarketGrid rows={rows} />
            </motion.div>
          ) : (
            <motion.div key="list" {...panelMotion}>
              <div className="xl:hidden">
                <MarketCompactList rows={rows} />
              </div>
              <div className="hidden xl:block">
                <MarketTable rows={rows} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {!isInitialLoading && !isError && rows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="border-t border-[var(--terminal-line)] px-4 py-10 text-center font-mono text-[0.76rem] uppercase text-[var(--terminal-text-muted)]"
            >
              No markets match your search.
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

function SettingsPanel() {
  return (
    <motion.div key="settings" {...panelMotion} className="grid gap-3 p-4 md:grid-cols-3">
      {["Compact rows", "Live animation", "Wallet gate"].map((setting, index) => (
        <motion.button
          key={setting}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, delay: index * 0.04 }}
          className="flex cursor-pointer items-center gap-3 border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-5 text-left font-mono text-[0.76rem] font-semibold uppercase text-[var(--terminal-text-strong)] hover:border-[var(--terminal-green)]"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          {setting}: On
        </motion.button>
      ))}
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
      <AlertTriangle className="h-6 w-6 text-[var(--danger)]" aria-hidden="true" />
      <p className="text-[0.84rem] font-semibold text-[var(--terminal-text-strong)]">Market feed unavailable</p>
      <p className="max-w-md text-[0.72rem] text-[var(--terminal-text-muted)]">
        The market endpoint failed validation or could not be reached.
      </p>
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
