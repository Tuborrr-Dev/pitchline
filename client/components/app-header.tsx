"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { connectWallet, selectWallet, useWallet } from "@/lib/wallet-session";

import { AppNav } from "./app-header/app-nav";
import { MarketSearch } from "./app-header/market-search";
import { WalletControl } from "./app-header/wallet-control";

import { useQuery } from "@tanstack/react-query";
import { finishedMarketOverviewQueryOptions, marketOverviewQueryOptions } from "@/queries/market-queries";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchSettled, setMobileSearchSettled] = useState(true);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const wallet = useWallet();
  const homeQuery = searchParams.get("q") ?? "";
  const isLanding = pathname === "/";
  const isMarkets = pathname.startsWith("/markets");
  const [localQuery, setLocalQuery] = useState(homeQuery);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const nextQuery = isMarkets ? homeQuery : "";
    if (localQuery === nextQuery) return;

    startTransition(() => {
      setLocalQuery(nextQuery);
    });
  }, [homeQuery, isMarkets, localQuery]);

  const query = localQuery;
  const showSearchResults = query.trim().length > 0;
  const mobileIconVisibility = mobileSearchSettled ? "opacity-100" : "opacity-0 sm:opacity-100";

  const { data: activeRows = [] } = useQuery(marketOverviewQueryOptions());
  const { data: finishedRows = [] } = useQuery(finishedMarketOverviewQueryOptions());

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const allRows = [...activeRows, ...finishedRows];
    const filtered = allRows.filter((row) => {
      const matchText = `${row.fixture.teamAName} ${row.fixture.teamACode} ${row.fixture.teamBName} ${row.fixture.teamBCode} ${row.fixture.competition} ${row.fixture.stage}`.toLowerCase();
      return matchText.includes(q);
    });
    return filtered.slice(0, 8).map((row) => ({
      id: row.fixture.fixtureId,
      label: `${row.fixture.teamAName || row.fixture.teamACode} VS ${row.fixture.teamBName || row.fixture.teamBCode}`,
      meta: `${row.fixture.competition}${row.fixture.stage ? ` / ${row.fixture.stage}` : ""}`,
    }));
  }, [query, activeRows, finishedRows]);

  function setMobileSearchOpenAnimated(open: boolean) {
    setMobileSearchSettled(false);
    setMobileSearchOpen(open);
    window.setTimeout(() => setMobileSearchSettled(true), 190);
  }

  useEffect(() => {
    if (!mobileSearchOpen) return;

    function closeSearchOnOutsideClick(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setMobileSearchOpenAnimated(false);
        setWalletPickerOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeSearchOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeSearchOnOutsideClick);
  }, [mobileSearchOpen]);

  function updateQuery(nextQuery: string) {
    setLocalQuery(nextQuery);

    if (!isMarkets) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(window.location.search);
        if (nextQuery.trim()) {
          params.set("q", nextQuery);
        } else {
          params.delete("q");
        }

        const search = params.toString();
        router.replace(`${pathname}${search ? `?${search}` : ""}`, { scroll: false });
      });
    }, 200);
  }

  function handleClear() {
    setLocalQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isMarkets) {
      startTransition(() => {
        const params = new URLSearchParams(window.location.search);
        params.delete("q");
        const search = params.toString();
        router.replace(`${pathname}${search ? `?${search}` : ""}`, { scroll: false });
      });
    }
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mobileSearchOpen && window.matchMedia("(max-width: 639px)").matches) {
      setMobileSearchOpenAnimated(true);
      return;
    }

    const params = new URLSearchParams();
    if (localQuery.trim()) params.set("q", localQuery);
    router.push(`${isMarkets ? pathname : "/markets"}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  async function handleWalletConnect() {
    if (wallet.isConnected || wallet.status === "checking") return;

    if (wallet.availableWallets.length > 1) {
      setWalletPickerOpen(true);
      return;
    }

    const result = await connectWallet();
    if (result && isLanding) {
      setWalletPickerOpen(false);
      window.setTimeout(() => router.push("/markets"), 260);
    }
  }

  async function handleWalletSelection(walletId: string) {
    selectWallet(walletId);
    const result = await connectWallet();
    if (result && isLanding) {
      setWalletPickerOpen(false);
      window.setTimeout(() => router.push("/markets"), 260);
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="shrink-0 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-strong)]"
    >
      <motion.div
        layout
        className="flex flex-col gap-2 px-3 py-2 sm:px-4 sm:py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-8">
          <Link
            href="/"
            className="w-fit self-start font-display text-[2rem] font-extrabold uppercase italic leading-none text-[var(--logo-cream)] sm:text-[2.65rem]"
          >
            PITCHLINE
          </Link>
          <AppNav isLanding={isLanding} pathname={pathname} />
        </div>

        <div
          ref={controlsRef}
          className={cn(
            "relative gap-2 sm:flex sm:items-center sm:gap-3",
            isLanding
              ? "flex"
              : mobileSearchOpen
                ? "grid grid-cols-[1fr_2.5rem]"
                : "grid grid-cols-[2.5rem_1fr]",
          )}
        >
          {!isLanding ? (
            <MarketSearch
              mobileIconVisibility={mobileIconVisibility}
              mobileSearchOpen={mobileSearchOpen}
              query={query}
              onClear={handleClear}
              onOpenMobileSearch={() => setMobileSearchOpenAnimated(true)}
              onResultSelect={(fixtureId) => {
                setMobileSearchOpenAnimated(false);
                router.push(`/match/${fixtureId}`);
              }}
              onSubmit={submitSearch}
              onUpdateQuery={updateQuery}
              searchResults={searchResults}
              showSearchResults={showSearchResults}
            />
          ) : null}

          <motion.div layout>
            <ThemeToggle />
          </motion.div>

          <WalletControl
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
