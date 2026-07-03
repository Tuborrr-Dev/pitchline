"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Grid3X3, List, Settings } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchMarketOverviewRows, type MarketOverviewRow } from "@/lib/market-service";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "grid";
type MarketTab = "markets" | "history" | "settings";

const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

function rowHref(row: MarketOverviewRow) {
  if (row.fixture.fixtureId === "bra-cro-pre") return "/match/bra-esp-live";
  if (row.fixture.fixtureId === "eng-sen-live") return "/match/arg-fra-live";
  return `/match/${row.fixture.fixtureId}`;
}

function cleanLabel(value: string) {
  return value.replace("Ã‚Â·", "/").replace("Â·", "/");
}

function OutcomeBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="flex h-7 w-full overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-home)] font-mono text-[0.72rem] font-semibold text-[#061009]"
        initial={false}
        animate={{ width: `${home}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {home.toFixed(1)}%
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-draw)] font-mono text-[0.72rem] font-semibold text-[#071018]"
        initial={false}
        animate={{ width: `${draw}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {draw.toFixed(1)}%
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-away)] font-mono text-[0.72rem] font-semibold text-[#15090d]"
        initial={false}
        animate={{ width: `${away}%` }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        {away.toFixed(1)}%
      </motion.div>
    </div>
  );
}

function StatusBadge({ row }: { row: MarketOverviewRow }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border px-2 font-mono text-[0.68rem] font-semibold leading-none",
        row.status === "live"
          ? "border-[#135238] bg-[var(--prob-home)] text-[#041009]"
          : "border-[#314e66] bg-[#203d53] text-[#d2edf7]",
      )}
    >
      {row.statusLabel}
    </span>
  );
}

function MarketRow({ row }: { row: MarketOverviewRow }) {
  const href = rowHref(row);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-t border-[var(--terminal-line)] px-4 py-3 text-[var(--foreground)] transition hover:bg-[#101820]"
    >
      <div className="flex items-center">
        <StatusBadge row={row} />
      </div>
      <div>
        <Link
          href={href}
          className="cursor-pointer font-display text-[1.25rem] font-bold uppercase text-white transition hover:text-[var(--terminal-green)]"
        >
          {row.eventPair}
        </Link>
        <p className="mt-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)]">
          {cleanLabel(row.eventSubLabel)}
        </p>
      </div>
      <div className="text-center">
        <p className="font-display text-[1.25rem] font-bold uppercase text-white">{row.scoreLine}</p>
        <p className="font-mono text-[0.7rem] uppercase text-[#9fb0bc]">{row.timeLabel}</p>
      </div>
      <div className="px-4">
        <OutcomeBar
          home={row.probabilities.home}
          draw={row.probabilities.draw}
          away={row.probabilities.away}
        />
      </div>
      <div className="text-right">
        <p className="font-display text-[1.2rem] font-bold uppercase text-white">{row.liquidity}</p>
        <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-green)]">
          Depth {row.depth}
        </p>
      </div>
      <div className="flex justify-end">
        <Button
          asChild
          className={cn(
            "h-8 min-w-[4.25rem] cursor-pointer rounded-none border px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
            row.actionTone === "primary"
              ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[#07110b] hover:bg-[#7affba]"
              : "border-[#3e5a6f] bg-transparent text-[#a6bfd0] hover:border-[#7fb8d8] hover:bg-transparent hover:text-white",
          )}
        >
          <Link href={href}>{row.action}</Link>
        </Button>
      </div>
    </motion.div>
  );
}

function MarketGrid({ rows }: { rows: MarketOverviewRow[] }) {
  return (
    <motion.div layout className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {rows.map((row) => (
          <motion.div
            key={row.fixture.fixtureId}
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <Link
              href={rowHref(row)}
              className="block cursor-pointer border border-[var(--terminal-border)] bg-[#0e151b] p-4 transition hover:border-[var(--terminal-green)] hover:bg-[#121b22]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[1.45rem] font-bold uppercase text-white">
                    {row.eventPair}
                  </p>
                  <p className="mt-1 font-mono text-[0.7rem] uppercase text-[var(--muted)]">
                    {cleanLabel(row.eventSubLabel)}
                  </p>
                </div>
                <StatusBadge row={row} />
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <p className="font-display text-[1.8rem] font-bold text-white">{row.scoreLine}</p>
                  <p className="font-mono text-[0.7rem] uppercase text-[#9fb0bc]">{row.timeLabel}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-[1.5rem] font-bold text-white">{row.liquidity}</p>
                  <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-green)]">
                    Depth {row.depth}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <OutcomeBar
                  home={row.probabilities.home}
                  draw={row.probabilities.draw}
                  away={row.probabilities.away}
                />
              </div>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export function MarketOverview({ initialRows }: { initialRows: MarketOverviewRow[] }) {
  const [activeTab, setActiveTab] = useState<MarketTab>("markets");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const searchParams = useSearchParams();
  const deferredQuery = useDeferredValue(searchParams.get("q") ?? "");

  const { data: rows = initialRows, isError, isFetching } = useQuery({
    queryKey: ["market-overview"],
    queryFn: fetchMarketOverviewRows,
    initialData: initialRows,
  });
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

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] pb-20 text-white">
      <main className="w-full overflow-hidden bg-[var(--terminal-bg)]">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-4 py-5 sm:px-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {(["markets", "history", "settings"] as const).map((tab) => (
                  <Button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "relative h-8 cursor-pointer rounded-none border px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
                      activeTab === tab
                        ? "border-[#d6dee5] bg-[#1d252d] text-white"
                        : "border-[#26313a] bg-transparent text-[#8e9ba6] hover:bg-[#111820] hover:text-white",
                    )}
                  >
                    {activeTab === tab ? (
                      <motion.span
                        layoutId="market-tab-active"
                        className="absolute inset-0 bg-white/[0.04]"
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      />
                    ) : null}
                    <span className="relative z-10">{tab}</span>
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h1
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.16 }}
                    className="font-display text-[2.25rem] font-bold uppercase leading-none text-[#dde4ea] sm:text-[2.45rem]"
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
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[0.72rem] font-semibold uppercase text-[#8e9ba6]">
                <span>Total liquidity: $42.52M</span>
                <span>Active markets: {filteredRows.length}</span>
                {isFetching ? <span>Refreshing feed</span> : null}
                {deferredQuery.trim() ? <span>Filter: {deferredQuery}</span> : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 lg:justify-end">
              <div className="text-right">
                <p className="flex items-center justify-end gap-2 font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)]">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                  System Live
                </p>
                <p className="font-mono text-[0.68rem] uppercase text-[#91a0ab]">Latency: 12ms</p>
              </div>
              <div className="flex border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
                <Button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "h-9 cursor-pointer rounded-none border-0 border-r border-[var(--terminal-border)] px-3 font-mono text-[0.7rem] font-semibold uppercase shadow-none",
                    viewMode === "list" ? "bg-[#242b33] text-[#dbe2e8]" : "bg-transparent text-[#8997a3] hover:bg-transparent hover:text-white",
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
                    viewMode === "grid" ? "bg-[#242b33] text-[#dbe2e8]" : "bg-transparent text-[#8997a3] hover:bg-transparent hover:text-white",
                  )}
                >
                  <Grid3X3 className="h-4 w-4" aria-hidden="true" />
                  Grid
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="px-3 py-5 sm:px-4">
          <div className="overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
            <AnimatePresence mode="wait">
              {activeTab === "settings" ? (
                <motion.div key="settings" {...panelMotion} className="grid gap-3 p-4 md:grid-cols-3">
                  {["Compact rows", "Live animation", "Wallet gate"].map((setting, index) => (
                    <motion.button
                      key={setting}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, delay: index * 0.04 }}
                      className="flex cursor-pointer items-center gap-3 border border-[#26313a] bg-[#10171d] px-4 py-5 text-left font-mono text-[0.76rem] font-semibold uppercase text-[#d4dde5] hover:border-[var(--terminal-green)]"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                      {setting}: On
                    </motion.button>
                  ))}
                </motion.div>
              ) : isError ? (
                <motion.div
                  key="error"
                  {...panelMotion}
                  className="flex min-h-[18rem] flex-col items-center justify-center gap-3 border-t border-[var(--terminal-line)] px-4 py-10 text-center font-mono uppercase"
                >
                  <AlertTriangle className="h-6 w-6 text-[var(--danger)]" aria-hidden="true" />
                  <p className="text-[0.84rem] font-semibold text-[#dbe5ed]">Market feed unavailable</p>
                  <p className="max-w-md text-[0.72rem] text-[#7d8993]">
                    The market endpoint failed validation or could not be reached.
                  </p>
                </motion.div>
              ) : isInitialLoading ? (
                <motion.div key="loading" {...panelMotion} className="space-y-0">
                  {[0, 1, 2].map((index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.05 }}
                      className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-t border-[var(--terminal-line)] px-4 py-4"
                    >
                      <div className="h-5 w-10 animate-pulse bg-[#172029]" />
                      <div className="space-y-2">
                        <div className="h-4 w-24 animate-pulse bg-[#172029]" />
                        <div className="h-3 w-36 animate-pulse bg-[#121920]" />
                      </div>
                      <div className="mx-auto h-4 w-12 animate-pulse bg-[#172029]" />
                      <div className="mx-4 h-7 animate-pulse bg-[#172029]" />
                      <div className="ml-auto h-4 w-16 animate-pulse bg-[#172029]" />
                      <div className="ml-auto h-8 w-16 animate-pulse bg-[#172029]" />
                    </motion.div>
                  ))}
                </motion.div>
              ) : viewMode === "grid" ? (
                <motion.div key="grid" {...panelMotion}>
                  <MarketGrid rows={filteredRows} />
                </motion.div>
              ) : (
                <motion.div key="list" {...panelMotion}>
                  <div className="grid min-w-[64rem] grid-cols-[5rem_15rem_8rem_1fr_8.5rem_5.5rem] items-center border-b border-[var(--terminal-border)] bg-[#20262d] px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase text-[#b4bec8]">
                    <div>Status</div>
                    <div>Event / Pair</div>
                    <div className="text-center">Score/Time</div>
                    <div className="px-4">Outcome Probability (Home / Draw / Away)</div>
                    <div className="text-right">Liquidity Depth</div>
                    <div className="text-right">Action</div>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {filteredRows.map((row) => (
                      <MarketRow key={row.fixture.fixtureId} row={row} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {!isInitialLoading && !isError && filteredRows.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  className="border-t border-[var(--terminal-line)] px-4 py-10 text-center font-mono text-[0.76rem] uppercase text-[#7d8993]"
                >
                  No markets match your search.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>

        <section className="fixed inset-x-0 bottom-8 z-40 flex flex-col gap-3 border-y border-[var(--terminal-border)] bg-[#070b10] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.68rem] font-semibold uppercase">
            <span className="text-[#b7c0c7]">Streaming 24 data feeds</span>
            <span className="text-[var(--terminal-green)]">Secure p2p orderbook active</span>
          </div>
          <p className="font-mono text-[0.68rem] font-semibold uppercase text-[#d5dce2]">
            Last update: 14:32:44 UTC
          </p>
        </section>

        <section className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--terminal-border)] bg-[#05080c] px-3 py-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[0.68rem] font-semibold uppercase">
            <span className="text-[#aeb8bf]">BTC/USD <span className="text-[var(--terminal-green)]">$64,210.42 (+1.2%)</span></span>
            <span className="text-[#aeb8bf]">SOL/USD <span className="text-[var(--terminal-green)]">$145.12 (+4.8%)</span></span>
            <span className="text-[#aeb8bf]">ETH/USD <span className="text-[#ea8a9f]">$3,421.10 (-0.4%)</span></span>
            <span className="text-[#aeb8bf]">BTC/USD <span className="text-[var(--terminal-green)]">$64,210.42 (+1.2%)</span></span>
            <span className="text-[#aeb8bf]">SOL/USD <span className="text-[var(--terminal-green)]">$145.12 (+4.8%)</span></span>
          </div>
        </section>
      </main>
    </div>
  );
}
