"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Grid3X3, List, Settings } from "lucide-react";
import { AnimatePresence, motion, useAnimationFrame } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useMarketOverviewStream } from "@/hooks/use-market-overview-stream";
import {
  fetchFinishedMarketOverviewRows,
  fetchMarketOverviewRows,
  type MarketOverviewRow,
} from "@/lib/market-service";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "grid";
type MarketTab = "markets" | "history" | "settings";

const tickerItems = [
  { label: "BTC/USD", value: "$64,210.42 (+1.2%)", tone: "up" },
  { label: "SOL/USD", value: "$145.12 (+4.8%)", tone: "up" },
  { label: "ETH/USD", value: "$3,421.10 (-0.4%)", tone: "down" },
  { label: "BTC/USD", value: "$64,210.42 (+1.2%)", tone: "up" },
  { label: "SOL/USD", value: "$145.12 (+4.8%)", tone: "up" },
] as const;

const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

function rowHref(row: MarketOverviewRow) {
  return `/match/${row.fixture.fixtureId}`;
}

function cleanLabel(value: string) {
  return value.replace("Ã‚Â·", "/").replace("Â·", "/");
}

function isUpcomingRow(row: MarketOverviewRow) {
  return row.fixture.status === "upcoming";
}

import { AnimatedPercentage } from "./animated-percentage";

function OutcomeBar({ home, draw, away }: { home: number; draw: number; away: number }) {
  return (
    <div className="flex h-7 w-full overflow-hidden border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-home)] font-mono text-[0.72rem] font-semibold text-[#061009]"
        initial={false}
        animate={{ width: `${home}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatedPercentage value={home} showDeltaBadge />
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-draw)] font-mono text-[0.72rem] font-semibold text-[#071018]"
        initial={false}
        animate={{ width: `${draw}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatedPercentage value={draw} showDeltaBadge />
      </motion.div>
      <motion.div
        className="flex items-center justify-center bg-[var(--prob-away)] font-mono text-[0.72rem] font-semibold text-[#15090d]"
        initial={false}
        animate={{ width: `${away}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <AnimatedPercentage value={away} showDeltaBadge />
      </motion.div>
    </div>
  );
}

function MarketTiming({ row, compact = false }: { row: MarketOverviewRow; compact?: boolean }) {
  if (isUpcomingRow(row)) {
    return (
      <>
        <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.35rem]" : "text-[1.15rem]")}>
          Kickoff
        </p>
        <p className={cn("font-mono uppercase text-[var(--terminal-text-muted)]", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
          {row.timeLabel}
        </p>
      </>
    );
  }

  return (
    <>
      <p className={cn("font-display font-bold uppercase text-[var(--terminal-text-strong)]", compact ? "text-[1.8rem]" : "text-[1.25rem]")}>
        {row.scoreLine}
      </p>
      <p className={cn("font-mono uppercase text-[var(--terminal-text-muted)]", compact ? "text-[0.72rem]" : "text-[0.7rem]")}>
        {row.timeLabel}
      </p>
    </>
  );
}

function StatusBadge({ row }: { row: MarketOverviewRow }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center border px-2 font-mono text-[0.68rem] font-semibold leading-none",
        row.status === "live"
          ? "border-[#135238] bg-[var(--prob-home)] text-[#041009]"
          : "border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text-strong)]",
      )}
    >
      {row.statusLabel}
    </span>
  );
}

import { TeamLogo } from "./team-logo";

function MarketRow({ row }: { row: MarketOverviewRow }) {
  const href = rowHref(row);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="grid min-w-[64rem] grid-cols-[6.5rem_18rem_9rem_1fr_8.5rem_5.5rem] items-center border-t border-[var(--terminal-line)] px-4 py-3 text-[var(--foreground)] transition hover:bg-[var(--terminal-hover)]"
    >
      <div className="flex items-center">
        <StatusBadge row={row} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <TeamLogo code={row.fixture.teamACode} name={row.fixture.teamAName} size="sm" />
          <Link
            href={href}
            className="cursor-pointer font-display text-[1.25rem] font-bold uppercase text-[var(--terminal-text-strong)] transition hover:text-[var(--terminal-green)]"
          >
            {row.eventPair}
          </Link>
          <TeamLogo code={row.fixture.teamBCode} name={row.fixture.teamBName} size="sm" />
        </div>
        <p className="mt-0.5 font-mono text-[0.68rem] uppercase text-[var(--muted)]">
          {cleanLabel(row.eventSubLabel)}
        </p>
      </div>
      <div className="text-center">
        <MarketTiming row={row} />
      </div>
      <div className="px-4">
        <OutcomeBar
          home={row.probabilities.home}
          draw={row.probabilities.draw}
          away={row.probabilities.away}
        />
      </div>
      <div className="text-right">
        <p className="font-display text-[1.2rem] font-bold uppercase text-[var(--terminal-text-strong)]">{row.liquidity}</p>
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
              ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--terminal-inverse-fg)] hover:bg-[var(--terminal-green)]"
              : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:border-[var(--terminal-blue)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
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
    <motion.div layout className="grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3">
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
              className="block cursor-pointer border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-4 transition hover:border-[var(--terminal-green)] hover:bg-[var(--terminal-hover)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[1.45rem] font-bold uppercase text-[var(--terminal-text-strong)]">
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
                  <MarketTiming row={row} compact />
                </div>
                <div className="text-right">
                  <p className="font-display text-[1.5rem] font-bold text-[var(--terminal-text-strong)]">{row.liquidity}</p>
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

function MarketCompactListRow({ row }: { row: MarketOverviewRow }) {
  const href = rowHref(row);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="border-t border-[var(--terminal-line)] px-4 py-4 transition hover:bg-[var(--terminal-hover)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge row={row} />
            <Link
              href={href}
              className="cursor-pointer font-display text-[1.55rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] transition hover:text-[var(--terminal-green)]"
            >
              {row.eventPair}
            </Link>
          </div>
          <p className="mt-2 font-mono text-[0.72rem] uppercase text-[var(--muted)]">
            {cleanLabel(row.eventSubLabel)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <MarketTiming row={row} compact />
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <OutcomeBar
          home={row.probabilities.home}
          draw={row.probabilities.draw}
          away={row.probabilities.away}
        />
        <div className="sm:text-right">
          <p className="font-display text-[1.45rem] font-bold leading-none text-[var(--terminal-text-strong)]">{row.liquidity}</p>
          <p className="mt-1 font-mono text-[0.72rem] uppercase text-[var(--terminal-green)]">
            Depth {row.depth}
          </p>
        </div>
        <div className="sm:justify-self-end">
          <Button
            asChild
            className={cn(
              "h-9 min-w-[5rem] cursor-pointer rounded-none border px-4 font-mono text-[0.72rem] font-semibold uppercase shadow-none",
              row.actionTone === "primary"
                ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--terminal-inverse-fg)] hover:bg-[var(--terminal-green)]"
                : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:border-[var(--terminal-blue)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
            )}
          >
            <Link href={href}>{row.action}</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function MarketOverview({ initialRows }: { initialRows: MarketOverviewRow[] }) {
  const [activeTab, setActiveTab] = useState<MarketTab>("markets");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktopTable, setIsDesktopTable] = useState(false);
  const tickerRef = useRef<HTMLDivElement | null>(null);
  const tickerPauseUntilRef = useRef(0);
  const searchParams = useSearchParams();
  const deferredQuery = useDeferredValue(searchParams.get("q") ?? "");

  const { data: fetchedActiveRows = initialRows, isError: isMarketsError, isFetching: isMarketsFetching } = useQuery({
    queryKey: ["market-overview"],
    queryFn: fetchMarketOverviewRows,
    initialData: initialRows,
  });

  const streamedActiveRows = useMarketOverviewStream(fetchedActiveRows, activeTab === "markets");

  const { data: finishedRows = [], isError: isFinishedError, isFetching: isFinishedFetching } = useQuery({
    queryKey: ["market-overview-finished"],
    queryFn: fetchFinishedMarketOverviewRows,
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
                        ? "border-[var(--terminal-active-bg)] bg-[var(--terminal-active-bg)] text-[var(--terminal-active-fg)]"
                        : "border-[var(--terminal-border)] bg-transparent text-[var(--terminal-text-muted)] hover:bg-[var(--terminal-hover)] hover:text-[var(--terminal-text-strong)]",
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
                <span>Total liquidity: $42.52M</span>
                <span>Active markets: {filteredRows.length}</span>
                {isFetching ? <span>Refreshing feed</span> : null}
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
              {!isMobile ? (
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
                      viewMode === "grid" ? "bg-[var(--terminal-active-bg)] text-[var(--terminal-active-fg)]" : "bg-transparent text-[var(--terminal-text-muted)] hover:bg-transparent hover:text-[var(--terminal-text-strong)]",
                    )}
                  >
                    <Grid3X3 className="h-4 w-4" aria-hidden="true" />
                    Grid
                  </Button>
                </div>
              ) : null}
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
                      className="flex cursor-pointer items-center gap-3 border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-5 text-left font-mono text-[0.76rem] font-semibold uppercase text-[var(--terminal-text-strong)] hover:border-[var(--terminal-green)]"
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
                  <p className="text-[0.84rem] font-semibold text-[var(--terminal-text-strong)]">Market feed unavailable</p>
                  <p className="max-w-md text-[0.72rem] text-[var(--terminal-text-muted)]">
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
              ) : effectiveViewMode === "grid" ? (
                <motion.div key="grid" {...panelMotion}>
                  <MarketGrid rows={filteredRows} />
                </motion.div>
              ) : !isDesktopTable ? (
                <motion.div key="compact-list" {...panelMotion}>
                  <div className="grid grid-cols-[5.5rem_1fr_5.5rem] items-center border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
                    <div>Status</div>
                    <div>Event / Market</div>
                    <div className="text-right">Score</div>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {filteredRows.map((row) => (
                      <MarketCompactListRow key={row.fixture.fixtureId} row={row} />
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="list" {...panelMotion}>
                  <div className="grid min-w-[64rem] grid-cols-[6.5rem_18rem_9rem_1fr_8.5rem_5.5rem] items-center border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
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
                  className="border-t border-[var(--terminal-line)] px-4 py-10 text-center font-mono text-[0.76rem] uppercase text-[var(--terminal-text-muted)]"
                >
                  No markets match your search.
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>

        <section className="fixed inset-x-0 bottom-8 z-40 hidden flex-col gap-3 border-y border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-3 md:flex md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.68rem] font-semibold uppercase">
            <span className="text-[var(--terminal-text-muted)]">Streaming 24 data feeds</span>
            <span className="text-[var(--terminal-green)]">Secure p2p orderbook active</span>
          </div>
          <p className="font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
            Last update: 14:32:44 UTC
          </p>
        </section>

        <section className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)] px-3 py-2">
          <div
            ref={tickerRef}
            className="overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max gap-x-5 gap-y-2 font-mono text-[0.68rem] font-semibold uppercase">
              {[...tickerItems, ...tickerItems].map((item, index) => (
                <span
                  key={`${item.label}-${index}`}
                  aria-hidden={index >= tickerItems.length}
                  className="text-[var(--terminal-text-muted)]"
                >
                  {item.label}{" "}
                  <span className={item.tone === "up" ? "text-[var(--terminal-green)]" : "text-[#ea8a9f]"}>
                    {item.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
