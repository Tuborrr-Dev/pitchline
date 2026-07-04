"use client";

import { Search, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setWalletConnectedState, useWalletConnected } from "@/lib/wallet-session";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", match: (pathname: string) => pathname === "/markets" },
  {
    href: "/match/arg-fra-live",
    label: "Live Terminal",
    match: (pathname: string) => pathname.startsWith("/match"),
  },
];

const SEARCH_RESULTS = [
  { id: "arg-fra-live", label: "ARG vs FRA", meta: "World Cup 2026 / Semi Final" },
  { id: "eng-sen-live", label: "ENG vs SEN", meta: "Round of 16 / Live market" },
  { id: "bra-cro-pre", label: "BRA vs CRO", meta: "Quarter finals / Pre market" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matchQuery, setMatchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchSettled, setMobileSearchSettled] = useState(true);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const walletConnected = useWalletConnected();
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

  function connectWallet() {
    setWalletConnectedState(true);
    if (isLanding) {
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

          <nav className="flex flex-wrap items-center gap-4 font-mono text-[0.68rem] font-semibold uppercase text-[#c3ccd4] sm:gap-5 sm:text-[0.78rem]">
            {isLanding ? (
              <>
                {[
                  ["#how-it-works", "System"],
                  ["#charts", "Charts"],
                  ["#access", "Access"],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="cursor-pointer text-[#a1adb8] transition hover:text-white">
                    {label}
                  </Link>
                ))}
              </>
            ) : (
              NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative cursor-pointer transition",
                      active
                        ? "pb-1 text-white"
                        : "text-[#a1adb8] hover:text-white",
                    )}
                  >
                    {item.label}
                    {active ? (
                      <motion.span
                        layoutId="app-nav-active"
                        className="absolute inset-x-0 -bottom-0.5 h-px bg-[#e1e7ee]"
                        transition={{ duration: 0.18, ease: "easeOut" }}
                      />
                    ) : null}
                  </Link>
                );
              })
            )}
          </nav>
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
            <motion.form
              layout
              onSubmit={submitSearch}
              onClick={() => {
                if (!mobileSearchOpen) setMobileSearchOpenAnimated(true);
              }}
              className={cn(
                "relative flex h-10 min-w-0 items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[#90a0ac] sm:h-11 sm:min-w-[18rem] sm:justify-start sm:px-3 lg:min-w-[22rem]",
                mobileSearchOpen ? "justify-start px-3" : "justify-center px-0",
              )}
              aria-label="Search markets"
            >
              <button
                type={mobileSearchOpen ? "submit" : "button"}
                onClick={() => {
                  if (!mobileSearchOpen) setMobileSearchOpenAnimated(true);
                }}
                className={cn(
                  "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-[#90a0ac] hover:text-white",
                  mobileIconVisibility,
                )}
                aria-label="Open search"
              >
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="SEARCH MARKETS..."
                autoFocus={mobileSearchOpen}
                className={cn(
                  "w-full bg-transparent font-mono text-[0.72rem] uppercase text-[#dbe5ed] outline-none placeholder:text-[#66737e] sm:text-[0.78rem]",
                  mobileSearchOpen ? "block" : "hidden sm:block",
                )}
              />
              <AnimatePresence initial={false}>
                {query ? (
                  <motion.button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateQuery("");
                    }}
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.82 }}
                    transition={{ duration: 0.14 }}
                    className={cn(
                      "h-4 w-4 shrink-0 cursor-pointer text-[#8fa0ad] hover:text-white",
                      mobileSearchOpen ? "flex items-center justify-center" : "hidden sm:flex sm:items-center sm:justify-center",
                    )}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4 shrink-0" />
                  </motion.button>
                ) : null}
              </AnimatePresence>
              <AnimatePresence>
                {showSearchResults ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 border border-[var(--terminal-border)] bg-[#081016] shadow-[0_18px_40px_rgba(0,0,0,0.36)] sm:hidden"
                  >
                    <p className="border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-[0.58rem] font-semibold uppercase text-[#72808b]">
                      Search results
                    </p>
                    {SEARCH_RESULTS.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => {
                          setMobileSearchOpenAnimated(false);
                          router.push(`/match/${result.id}`);
                        }}
                        className="block w-full cursor-pointer border-b border-[#13202a] px-3 py-2 text-left font-mono uppercase hover:bg-[#101a22]"
                      >
                        <span className="block text-[0.72rem] font-semibold text-[#dfe8ee]">{result.label}</span>
                        <span className="mt-1 block text-[0.58rem] text-[#7d8993]">{result.meta}</span>
                      </button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.form>
          ) : null}

          <motion.div layout>
            <Button
            type="button"
            onClick={connectWallet}
            className={cn(
              "h-10 min-w-0 cursor-pointer rounded-none border px-3 font-mono text-[0.68rem] font-semibold uppercase shadow-none sm:h-11 sm:px-4 sm:text-[0.78rem]",
              mobileSearchOpen && !isLanding && "w-10 px-0 sm:w-auto sm:px-4",
              walletConnected
                ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[#06110b]"
                : "border-[#0fc26f] bg-transparent text-[var(--terminal-green)] hover:bg-[#0c1d15]",
            )}
          >
            <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center", mobileIconVisibility)}>
              <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={walletConnected ? "connected" : "disconnected"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className={cn(mobileSearchOpen && !isLanding ? "hidden sm:inline" : "inline")}
              >
                {walletConnected ? "0x71c...9A4F" : "Connect Wallet"}
              </motion.span>
            </AnimatePresence>
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </motion.header>
  );
}
