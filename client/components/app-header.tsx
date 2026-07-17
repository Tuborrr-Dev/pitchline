"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { connectWallet, selectWallet, useWallet } from "@/lib/wallet-session";

import { AppNav } from "./app-header/app-nav";
import { MarketSearch } from "./app-header/market-search";
import { NotificationCenter } from "./app-header/notification-center";
import { WalletControl } from "./app-header/wallet-control";
import { useWalletConnectModal } from "@/components/wallet-connect-provider";
import { WALLETCONNECT_WALLET_ID } from "@/lib/wallet-session";

import { useQuery } from "@tanstack/react-query";
import { finishedMarketOverviewQueryOptions, marketOverviewQueryOptions } from "@/queries/market-queries";
import type { MarketOverviewRow } from "@/schemas/market";
import { rowHref } from "@/components/market-overview/utils";

type SearchStatus = "live" | "scheduled" | "final";

type IndexedSearchRow = {
  href: string;
  id: string;
  label: string;
  meta: string;
  score: string;
  searchText: string;
  sortGroup: number;
  status: SearchStatus;
  statusLabel: string;
  timeLabel: string;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getSearchStatus(row: MarketOverviewRow): SearchStatus {
  if (row.fixture.status === "finished") return "final";
  if (row.fixture.status === "upcoming") return "scheduled";
  return "live";
}

function getSearchScore(row: MarketOverviewRow) {
  if (row.fixture.status === "upcoming") return "KICKOFF";
  return row.scoreLine;
}

function getSearchStatusLabel(status: SearchStatus, row: MarketOverviewRow) {
  if (status === "final") return "FINAL";
  if (status === "scheduled") return "SCHEDULED";
  return row.statusLabel || "LIVE";
}

function indexSearchRow(row: MarketOverviewRow): IndexedSearchRow {
  const status = getSearchStatus(row);
  const label = `${row.fixture.teamAName || row.fixture.teamACode} VS ${row.fixture.teamBName || row.fixture.teamBCode}`;
  const statusLabel = getSearchStatusLabel(status, row);
  const searchableParts = [
    row.fixture.fixtureId,
    row.fixture.teamAName,
    row.fixture.teamACode,
    row.fixture.teamBName,
    row.fixture.teamBCode,
    row.fixture.competition,
    row.fixture.stage,
    row.fixture.status,
    row.fixture.phase,
    row.eventPair,
    row.eventSubLabel,
    row.statusLabel,
    statusLabel,
    row.scoreLine,
    row.timeLabel,
  ];

  return {
    href: rowHref(row),
    id: row.fixture.fixtureId,
    label,
    meta: `${row.fixture.competition}${row.fixture.stage ? ` / ${row.fixture.stage}` : ""}`,
    score: getSearchScore(row),
    searchText: normalizeSearchValue(searchableParts.filter(Boolean).join(" ")),
    sortGroup: status === "live" ? 0 : status === "scheduled" ? 1 : 2,
    status,
    statusLabel,
    timeLabel: row.timeLabel || row.fixture.minute || row.fixture.phase || "",
  };
}

function scoreSearchResult(item: IndexedSearchRow, query: string) {
  const normalizedLabel = normalizeSearchValue(item.label);
  const normalizedId = normalizeSearchValue(item.id);
  if (normalizedId === query) return 0;
  if (normalizedLabel.startsWith(query)) return 1;
  if (item.searchText.split(/\s+/).some((part) => part.startsWith(query))) return 2;
  if (item.searchText.includes(query)) return 3;
  return null;
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchSettled, setMobileSearchSettled] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const wallet = useWallet();
  const walletConnect = useWalletConnectModal();
  const isLanding = pathname === "/";
  const isMatchRoute = pathname.startsWith("/match/");
  const [localQuery, setLocalQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const query = localQuery;
  const showSearchResults = searchResultsOpen && query.trim().length > 0 && debouncedSearchQuery.trim().length > 0;
  const mobileIconVisibility = mobileSearchSettled ? "opacity-100" : "opacity-0 sm:opacity-100";

  const { data: activeRows = [] } = useQuery(marketOverviewQueryOptions());
  const { data: finishedRows = [] } = useQuery(finishedMarketOverviewQueryOptions());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(localQuery);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [localQuery]);

  const searchIndex = useMemo(() => {
    const rowsById = new Map<string, MarketOverviewRow>();
    for (const row of activeRows) {
      rowsById.set(row.fixture.fixtureId, row);
    }
    for (const row of finishedRows) {
      if (!rowsById.has(row.fixture.fixtureId)) {
        rowsById.set(row.fixture.fixtureId, row);
      }
    }

    return Array.from(rowsById.values()).map(indexSearchRow);
  }, [activeRows, finishedRows]);

  const searchResults = useMemo(() => {
    const q = normalizeSearchValue(debouncedSearchQuery);
    if (!q) return [];

    return searchIndex
      .map((item) => {
        const score = scoreSearchResult(item, q);
        return score === null ? null : { item, score };
      })
      .filter((result): result is { item: IndexedSearchRow; score: number } => result !== null)
      .sort((a, b) => a.score - b.score || a.item.sortGroup - b.item.sortGroup || a.item.label.localeCompare(b.item.label))
      .slice(0, 10)
      .map(({ item }) => item);
  }, [debouncedSearchQuery, searchIndex]);

  function setMobileSearchOpenAnimated(open: boolean) {
    setMobileSearchSettled(false);
    setMobileSearchOpen(open);
    window.setTimeout(() => setMobileSearchSettled(true), 190);
  }

  useEffect(() => {
    if (!mobileSearchOpen && !mobileMenuOpen && !searchResultsOpen) return;

    function closeSearchOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      const insideDesktopControls = controlsRef.current?.contains(target);
      const insideMobileMenu = mobileMenuRef.current?.contains(target);

      if (!insideDesktopControls && !insideMobileMenu) {
        setMobileSearchOpenAnimated(false);
        setMobileMenuOpen(false);
        setSearchResultsOpen(false);
        setWalletPickerOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeSearchOnOutsideClick);
  }, [mobileSearchOpen, mobileMenuOpen, searchResultsOpen]);

  function updateQuery(nextQuery: string) {
    setLocalQuery(nextQuery);
    setSearchResultsOpen(nextQuery.trim().length > 0);
  }

  function handleClear() {
    setLocalQuery("");
    setDebouncedSearchQuery("");
    setSearchResultsOpen(false);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mobileSearchOpen && window.matchMedia("(max-width: 639px)").matches) {
      setMobileSearchOpenAnimated(true);
      return;
    }

    if (searchResults[0]) {
      setSearchResultsOpen(false);
      setLocalQuery("");
      setDebouncedSearchQuery("");
      router.push(searchResults[0].href);
      return;
    }

    setSearchResultsOpen(localQuery.trim().length > 0);
  }

  async function handleWalletConnect() {
    if ((wallet.isConnected && wallet.isSupportedChain) || wallet.status === "checking") return;

    if (wallet.isWrongNetwork) {
      if (wallet.source === WALLETCONNECT_WALLET_ID) {
        await walletConnect.openConnect();
        return;
      }

      const result = await connectWallet();
      if (result?.isSupportedChain && isLanding) {
        setWalletPickerOpen(false);
        window.setTimeout(() => router.push("/markets"), 260);
      }
      return;
    }

    if (wallet.availableWallets.length > 1) {
      setWalletPickerOpen(true);
      return;
    }

    if (wallet.selectedWalletId === WALLETCONNECT_WALLET_ID) {
      await walletConnect.openConnect();
      return;
    }

    const result = await connectWallet();
    if (result?.isSupportedChain && isLanding) {
      setWalletPickerOpen(false);
      window.setTimeout(() => router.push("/markets"), 260);
    }
  }

  async function handleWalletSelection(walletId: string) {
    selectWallet(walletId);

    if (walletId === WALLETCONNECT_WALLET_ID) {
      setWalletPickerOpen(false);
      await walletConnect.openConnect();
      return;
    }

    const result = await connectWallet();
    if (result?.isSupportedChain && isLanding) {
      setWalletPickerOpen(false);
      window.setTimeout(() => router.push("/markets"), 260);
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative shrink-0 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)]"
    >
      <motion.div
        layout
        className="px-3 py-2 sm:flex sm:flex-col sm:gap-2 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div ref={mobileMenuRef} className="sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="w-fit font-display text-[1.55rem] font-extrabold uppercase italic leading-none text-[var(--logo-cream)]"
            >
              PITCHLINE
            </Link>
            <div className="flex items-center gap-2">
              <NotificationCenter />
              <button
                type="button"
                onClick={() => {
                  const nextOpen = !mobileMenuOpen;
                  setMobileMenuOpen(nextOpen);
                  setMobileSearchOpenAnimated(nextOpen);
                }}
                className="flex h-10 w-10 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--foreground)] hover:bg-[var(--terminal-panel)]"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {mobileMenuOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="absolute left-0 right-0 top-full z-50 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)] px-3 py-3 shadow-[0_18px_40px_var(--terminal-shadow)]"
              >
                <div className="flex flex-col gap-3">
                  <div onClick={() => setMobileMenuOpen(false)}>
                    <AppNav isLanding={isLanding} pathname={pathname} />
                  </div>
                  {!isLanding ? (
                    <MarketSearch
                      mobileIconVisibility={mobileIconVisibility}
                      mobileSearchOpen
                      query={query}
                      onClear={handleClear}
                      onOpenMobileSearch={() => setMobileSearchOpenAnimated(true)}
                      onOpenResults={() => setSearchResultsOpen(query.trim().length > 0)}
                      onResultSelect={(href) => {
                        setMobileMenuOpen(false);
                        setMobileSearchOpenAnimated(false);
                        setSearchResultsOpen(false);
                        setLocalQuery("");
                        setDebouncedSearchQuery("");
                        router.push(href);
                      }}
                      onSubmit={submitSearch}
                      onUpdateQuery={updateQuery}
                      searchResults={searchResults}
                      showSearchResults={showSearchResults}
                    />
                  ) : null}
                  <div className="grid grid-cols-[2.5rem_1fr] gap-2">
                    <ThemeToggle />
                    <WalletControl
                      fullWidth
                      isLanding={isLanding}
                      mobileIconVisibility={mobileIconVisibility}
                      mobileSearchOpen={false}
                      onConnect={() => void handleWalletConnect()}
                      onSelectWallet={(walletId) => void handleWalletSelection(walletId)}
                      wallet={wallet}
                      walletPickerOpen={walletPickerOpen}
                    />
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className={cn(
          "hidden min-w-0 gap-2 sm:flex lg:flex-row lg:items-center lg:gap-8",
          isMatchRoute ? "flex-row items-center sm:flex-col sm:items-start lg:flex-row lg:items-center" : "flex-col",
        )}>
          <Link
            href="/"
            className={cn(
              "w-fit self-start font-display font-extrabold uppercase italic leading-none text-[var(--logo-cream)]",
              isMatchRoute ? "text-[1.45rem] sm:text-[2.65rem]" : "text-[2rem] sm:text-[2.65rem]",
            )}
          >
            PITCHLINE
          </Link>
          <div className={cn(isMatchRoute && "hidden sm:block")}>
            <AppNav isLanding={isLanding} pathname={pathname} />
          </div>
        </div>

        <div
          ref={controlsRef}
          className={cn(
            "relative hidden gap-2 sm:flex sm:items-center sm:gap-3",
            isMatchRoute && "shrink-0",
          )}
        >
          {!isLanding ? (
            <MarketSearch
              mobileIconVisibility={mobileIconVisibility}
              mobileSearchOpen={mobileSearchOpen}
              query={query}
              onClear={handleClear}
              onOpenMobileSearch={() => setMobileSearchOpenAnimated(true)}
              onOpenResults={() => setSearchResultsOpen(query.trim().length > 0)}
              onResultSelect={(href) => {
                setMobileSearchOpenAnimated(false);
                setSearchResultsOpen(false);
                setLocalQuery("");
                setDebouncedSearchQuery("");
                router.push(href);
              }}
              onSubmit={submitSearch}
              onUpdateQuery={updateQuery}
              searchResults={searchResults}
              showSearchResults={showSearchResults}
            />
          ) : null}

          <motion.div layout className="flex items-center gap-2">
            <NotificationCenter />
            <ThemeToggle />
          </motion.div>

          <WalletControl
            compactMobile={isMatchRoute}
            isLanding={isLanding}
            mobileIconVisibility={mobileIconVisibility}
            mobileSearchOpen={mobileSearchOpen}
            onConnect={() => void handleWalletConnect()}
            onSelectWallet={(walletId) => void handleWalletSelection(walletId)}
            wallet={wallet}
            walletPickerOpen={walletPickerOpen}
          />
        </div>
      </motion.div>
    </motion.header>
  );
}


