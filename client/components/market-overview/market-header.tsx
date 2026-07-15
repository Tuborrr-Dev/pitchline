"use client";

import { Activity, Grid3X3, List } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { MarketTab, ViewMode } from "./types";

export function MarketHeader({
  activeTab,
  deferredQuery,
  effectiveViewMode,
  filteredCount,
  isFetching,
  isMobile,
  setViewMode,
  viewMode,
}: {
  activeTab: MarketTab;
  deferredQuery: string;
  effectiveViewMode: ViewMode;
  filteredCount: number;
  isFetching: boolean;
  isMobile: boolean;
  setViewMode: (mode: ViewMode) => void;
  viewMode: ViewMode;
}) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-4 py-5 sm:px-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <MarketTabs activeTab={activeTab} />
          <div className="flex flex-wrap items-center gap-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16 }}
                className="font-display text-[2rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:text-[2.45rem] lg:text-[2.75rem]"
              >
                {activeTab === "markets" && "World Cup: Market Overview (F-07)"}
                {activeTab === "history" && "Market History"}
                {activeTab === "settings" && "Terminal Settings"}
              </motion.h1>
            </AnimatePresence>
            <span className="inline-flex h-6 items-center bg-[var(--danger)] px-2 font-mono text-[0.68rem] font-semibold uppercase text-white">
              High Vol
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
            <span>{activeTab === "history" ? "Settled markets" : "Active markets"}: {filteredCount}</span>
            {isMounted && isFetching ? <span>Refreshing feed</span> : null}
            {deferredQuery.trim() ? <span>Filter: {deferredQuery}</span> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <div className="text-left sm:text-right">
            <p className="flex items-center gap-2 font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)] sm:justify-end">
              <Activity className="h-4 w-4" aria-hidden="true" />
              System Live
            </p>
            <p className="font-mono text-[0.68rem] uppercase text-[var(--terminal-text-muted)]">Latency: 12ms</p>
          </div>
          {!isMobile && activeTab !== "settings" ? (
            <ViewModeToggle
              effectiveViewMode={effectiveViewMode}
              setViewMode={setViewMode}
              viewMode={viewMode}
            />
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

function MarketTabs({ activeTab }: { activeTab: MarketTab }) {
  const tabHref: Record<MarketTab, string> = {
    markets: "/markets",
    history: "/markets/history",
    settings: "/markets/settings",
  };

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {(["markets", "history", "settings"] as const).map((tab) => (
        <Button
          key={tab}
          asChild
          className={cn(
            "relative h-8 cursor-pointer rounded-none border px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
            activeTab === tab
              ? "border-[var(--terminal-active-bg)] bg-[var(--terminal-active-bg)] text-white hover:bg-[var(--terminal-active-bg)] hover:text-white"
              : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:bg-[var(--terminal-hover)] hover:text-[var(--terminal-text-strong)]",
          )}
        >
          <Link href={tabHref[tab]}>
            {activeTab === tab ? (
              <motion.span
                layoutId="market-tab-active"
                className="absolute inset-0 bg-white/[0.04]"
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
            ) : null}
            <span className={cn("relative z-10", activeTab === tab && "text-white")}>{tab}</span>
          </Link>
        </Button>
      ))}
    </div>
  );
}

function ViewModeToggle({
  effectiveViewMode,
  setViewMode,
  viewMode,
}: {
  effectiveViewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  viewMode: ViewMode;
}) {
  return (
    <div className="flex border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <Button
        type="button"
        onClick={() => setViewMode("list")}
        className={cn(
          "h-9 cursor-pointer rounded-none border-0 border-r border-[var(--terminal-border)] px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
          effectiveViewMode === "list"
            ? "bg-[var(--terminal-active-bg)] text-[var(--terminal-active-fg)]"
            : "bg-transparent text-[var(--terminal-text-muted)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
        )}
      >
        <List className="h-4 w-4" aria-hidden="true" />
        List
      </Button>
      <Button
        type="button"
        onClick={() => setViewMode("grid")}
        className={cn(
          "h-9 cursor-pointer rounded-none border-0 px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
          viewMode === "grid"
            ? "bg-[var(--terminal-active-bg)] text-[var(--terminal-active-fg)]"
            : "bg-transparent text-[var(--terminal-text-muted)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
        )}
      >
        <Grid3X3 className="h-4 w-4" aria-hidden="true" />
        Grid
      </Button>
    </div>
  );
}
