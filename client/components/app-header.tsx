"use client";

import { Search, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";

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

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matchQuery, setMatchQuery] = useState("");
  const walletConnected = useWalletConnected();
  const homeQuery = searchParams.get("q") ?? "";
  const isLanding = pathname === "/";
  const isMarkets = pathname === "/markets";
  const query = isMarkets ? homeQuery : matchQuery;

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
        className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
          <Link
            href="/"
            className="font-display text-[2.65rem] font-extrabold uppercase italic leading-none text-[var(--logo-cream)]"
          >
            PITCHLINE
          </Link>

          <nav className="flex flex-wrap items-center gap-5 font-mono text-[0.78rem] font-semibold uppercase text-[#c3ccd4]">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {!isLanding ? (
            <form
              onSubmit={submitSearch}
              className="flex h-11 min-w-[16rem] items-center gap-2 border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 text-[#90a0ac] sm:min-w-[18rem] lg:min-w-[22rem]"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="SEARCH MARKETS..."
                className="w-full bg-transparent font-mono text-[0.78rem] uppercase text-[#dbe5ed] outline-none placeholder:text-[#66737e]"
              />
              <AnimatePresence initial={false}>
                {query ? (
                  <motion.button
                    type="button"
                    onClick={() => updateQuery("")}
                    initial={{ opacity: 0, scale: 0.82 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.82 }}
                    transition={{ duration: 0.14 }}
                    className="cursor-pointer text-[#8fa0ad] hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </form>
          ) : null}

          <Button
            type="button"
            onClick={connectWallet}
            className={cn(
              "h-11 cursor-pointer rounded-none border px-4 font-mono text-[0.78rem] font-semibold uppercase shadow-none",
              walletConnected
                ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[#06110b]"
                : "border-[#0fc26f] bg-transparent text-[var(--terminal-green)] hover:bg-[#0c1d15]",
            )}
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={walletConnected ? "connected" : "disconnected"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
              >
                {walletConnected ? "0x71c...9A4F" : "Connect Wallet"}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </motion.div>
    </motion.header>
  );
}
