"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { connectWallet, selectWallet, useWallet } from "@/lib/wallet-session";

import { AppNav } from "./app-header/app-nav";
import { MarketSearch } from "./app-header/market-search";
import { WalletControl } from "./app-header/wallet-control";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matchQuery, setMatchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchSettled, setMobileSearchSettled] = useState(true);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const wallet = useWallet();
  const homeQuery = searchParams.get("q") ?? "";
  const isLanding = pathname === "/";
  const isMarkets = pathname === "/markets";
  const query = isMarkets ? homeQuery : matchQuery;
  const showSearchResults = mobileSearchOpen && query.trim().length > 0;
  const mobileIconVisibility = mobileSearchSettled ? "opacity-100" : "opacity-0 sm:opacity-100";

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
    if (!isMarkets) {
      setMatchQuery(nextQuery);
      return;
    }

    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery.trim()) {
        params.set("q", nextQuery);
      } else {
        params.delete("q");
      }

      const search = params.toString();
      router.replace(`/markets${search ? `?${search}` : ""}`);
    });
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mobileSearchOpen && window.matchMedia("(max-width: 639px)").matches) {
      setMobileSearchOpenAnimated(true);
      return;
    }

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query);
    router.push(`/markets${params.toString() ? `?${params.toString()}` : ""}`);
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
              onClear={() => updateQuery("")}
              onOpenMobileSearch={() => setMobileSearchOpenAnimated(true)}
              onResultSelect={(fixtureId) => {
                setMobileSearchOpenAnimated(false);
                router.push(`/match/${fixtureId}`);
              }}
              onSubmit={submitSearch}
              onUpdateQuery={updateQuery}
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
