"use client";

import { Activity, ArrowRight, BarChart3, Check, LineChart, LockKeyhole, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { connectWallet, selectWallet, useWallet } from "@/lib/wallet-session";

const chartPoints = [
  "0,62",
  "12,62",
  "12,44",
  "31,44",
  "31,26",
  "55,26",
  "55,36",
  "75,36",
  "75,18",
  "100,18",
];

const inversePoints = [
  "0,54",
  "12,54",
  "12,70",
  "31,70",
  "31,78",
  "55,78",
  "55,63",
  "75,63",
  "75,82",
  "100,82",
];

function MiniTerminalChart() {
  return (
    <div className="border border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 shadow-[0_24px_80px_var(--terminal-shadow)]">
      <div className="grid grid-cols-3 border-b border-[var(--terminal-border)] font-mono text-[0.68rem] font-semibold uppercase">
        <div className="border-r border-[var(--terminal-border)] px-3 py-2 text-[var(--terminal-green)]">
          ARG Equity
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">61.8%</p>
        </div>
        <div className="border-r border-[var(--terminal-border)] px-3 py-2 text-[#ff4b6e]">
          FRA Equity
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">20.2%</p>
        </div>
        <div className="px-3 py-2 text-[var(--terminal-blue)]">
          Volatility
          <p className="mt-1 font-display text-[1.6rem] text-[var(--terminal-text-strong)]">18.0</p>
        </div>
      </div>

      <div className="relative h-64 overflow-hidden bg-[linear-gradient(90deg,var(--terminal-grid-strong)_1px,transparent_1px),linear-gradient(var(--terminal-grid-strong)_1px,transparent_1px)] bg-[size:28px_28px] p-4">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          <defs>
            <linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#00ff87" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#00ff87" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          <polygon fill="url(#landing-chart-fill)" points={`0,100 ${chartPoints.join(" ")} 100,100`} />
          <polyline fill="none" stroke="#00ff87" strokeWidth="1.8" points={chartPoints.join(" ")} vectorEffect="non-scaling-stroke" />
          <polyline fill="none" stroke="#ff4b6e" strokeWidth="1.6" points={inversePoints.join(" ")} vectorEffect="non-scaling-stroke" />
          <polyline fill="none" stroke="#10a2cc" strokeWidth="1" points="0,86 20,82 40,88 55,70 72,76 100,64" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute left-[48%] top-[30%] border border-[var(--terminal-green)] bg-emerald-500/10 px-2 py-1 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-green)]">
          Goal shock +17.2%
        </div>
        <div className="absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
          <span>Kickoff</span>
          <span>HT</span>
          <span>90&apos;</span>
        </div>
      </div>
    </div>
  );
}

function ConnectWalletModal({
  open,
  connected,
  addressLabel,
  error,
  isConnecting,
  hasProvider,
  availableWallets,
  selectedWalletId,
  onClose,
  onConnect,
  onSelectWallet,
  onEnterApp,
}: {
  open: boolean;
  connected: boolean;
  addressLabel: string | null;
  error: string | null;
  isConnecting: boolean;
  hasProvider: boolean;
  availableWallets: Array<{ id: string; name: string }>;
  selectedWalletId: string | null;
  onClose: () => void;
  onConnect: () => Promise<void>;
  onSelectWallet: (walletId: string) => void;
  onEnterApp: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-[0_24px_80px_var(--terminal-shadow)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-4 py-3">
              <p className="font-mono text-[0.76rem] font-semibold uppercase text-[var(--terminal-text-strong)]">
                Wallet Access
              </p>
              <button type="button" onClick={onClose} className="cursor-pointer text-[var(--terminal-text-muted)] hover:text-[var(--terminal-text-strong)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("flex h-10 w-10 items-center justify-center border", connected ? "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]" : "border-[var(--terminal-border)] text-[var(--terminal-text-muted)]")}>
                    {connected ? <Check className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="font-display text-[1.35rem] font-bold uppercase text-[var(--terminal-text-strong)]">
                      {connected ? addressLabel : hasProvider ? "No Wallet Connected" : "Wallet Not Found"}
                    </p>
                    <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-text-muted)]">
                      {connected
                        ? "Session unlocked"
                        : hasProvider
                          ? "Connect to enter the market terminal"
                          : "Install MetaMask or another EVM wallet"}
                    </p>
                  </div>
                </div>
              </div>

              {availableWallets.length > 1 ? (
                <div className="mt-4 border border-[var(--terminal-border)] bg-[var(--terminal-surface)]">
                  <p className="border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
                    Choose wallet provider
                  </p>
                  <div className="p-2">
                    {availableWallets.map((walletOption) => (
                      <button
                        key={walletOption.id}
                        type="button"
                        onClick={() => onSelectWallet(walletOption.id)}
                        className={cn(
                          "mb-2 flex w-full cursor-pointer items-center justify-between border px-3 py-2 font-mono text-[0.7rem] font-semibold uppercase last:mb-0",
                          selectedWalletId === walletOption.id
                            ? "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]"
                            : "border-[var(--terminal-border)] text-[var(--terminal-text-strong)] hover:bg-[var(--terminal-hover)]",
                        )}
                      >
                        <span>{walletOption.name}</span>
                        <span>{selectedWalletId === walletOption.id ? "Selected" : "Select"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {error ? (
                <p className="mt-3 border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-[0.66rem] uppercase text-[#d71945]">
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={connected ? onEnterApp : onConnect}
                disabled={isConnecting}
                className="mt-4 h-11 w-full cursor-pointer rounded-none border border-[var(--terminal-green)] bg-[var(--terminal-green)] font-mono text-[0.76rem] font-semibold uppercase text-[var(--terminal-inverse-fg)] shadow-none hover:bg-[var(--terminal-green)]"
              >
                {connected
                  ? "Enter Markets"
                  : isConnecting
                    ? "Connecting..."
                    : availableWallets.length > 1 && !selectedWalletId
                      ? "Choose Wallet"
                    : hasProvider
                      ? "Connect Wallet"
                      : "Install Wallet"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function LandingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const wallet = useWallet();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const heroImage = isDark
    ? "/images/pitchline-hero-football.png"
    : "/images/pitchline-hero-football-light.png";
  const heroImageClass = isDark ? "object-cover opacity-55" : "object-cover opacity-95";
  const heroOverlayClass = isDark
    ? "absolute inset-0 bg-[linear-gradient(90deg,#05080c_0%,rgba(5,8,12,0.86)_34%,rgba(5,8,12,0.42)_66%,#05080c_100%)]"
    : "absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.94)_0%,rgba(248,250,252,0.68)_36%,rgba(248,250,252,0.18)_72%,rgba(248,250,252,0.46)_100%)]";

  function enterApp() {
    router.push("/markets");
  }

  async function handleConnect() {
    await connectWallet();
  }

  function handleWalletSelection(walletId: string) {
    selectWallet(walletId);
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] text-[var(--terminal-text)]">
      <main className="bg-[linear-gradient(90deg,var(--terminal-grid)_1px,transparent_1px),linear-gradient(var(--terminal-grid)_1px,transparent_1px)] bg-[size:28px_28px]">
        <section className="relative min-h-[calc(100vh-5.125rem)] overflow-hidden border-b border-[var(--terminal-border)]">
          <Image
            src={heroImage}
            alt="Footballer shooting while a goalkeeper dives through a data-rich stadium scene"
            fill
            priority
            className={heroImageClass}
          />
          <div className={heroOverlayClass} />
          <div className="relative z-10 grid min-h-[calc(100vh-5.125rem)] items-center gap-8 px-4 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,0.75fr)] lg:px-8">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
              <div className="mb-5 inline-flex items-center gap-2 border border-[var(--terminal-green)] bg-emerald-500/10 px-3 py-2 font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)]">
                <Activity className="h-4 w-4" />
                Match analysis for chart-native users
              </div>
              <h1 className="max-w-4xl font-display text-[4rem] font-extrabold uppercase italic leading-[0.9] text-[var(--logo-cream)] sm:text-[5.5rem] lg:text-[7rem]">
                Football markets in chart form.
              </h1>
              <p className="mt-5 max-w-2xl text-[1.15rem] leading-8 text-[var(--terminal-text)]">
                Pitchline turns live match momentum, probability shifts, liquidity depth, and volatility shocks into a trading-style terminal for people who understand charts faster than commentary.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="h-12 cursor-pointer rounded-none border border-[var(--terminal-green)] bg-[var(--terminal-green)] px-5 font-mono text-[0.78rem] font-semibold uppercase text-[var(--terminal-inverse-fg)] shadow-none hover:bg-[var(--terminal-green)]"
                >
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </Button>
                <Button
                  type="button"
                  onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-12 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-5 font-mono text-[0.78rem] font-semibold uppercase text-[var(--terminal-text)] shadow-none hover:bg-[var(--terminal-hover)]"
                >
                  View System
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.32, delay: 0.08 }} className="lg:translate-y-8">
              <MiniTerminalChart />
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-4 py-14 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              ["Live Probability", "Every goal, card, penalty, and phase change becomes an equity move for each side."],
              ["Volatility Shock", "High-impact moments are tracked like market shocks, making momentum swings easy to scan."],
              ["Liquidity View", "Matches are framed as orderbooks, so users can read depth and pressure without waiting for narration."],
            ].map(([title, copy], index) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.22, delay: index * 0.05 }}
                className="border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5"
              >
                <LineChart className="mb-5 h-5 w-5 text-[var(--terminal-green)]" />
                <p className="font-display text-[1.8rem] font-bold uppercase text-[var(--terminal-text-strong)]">{title}</p>
                <p className="mt-3 leading-7 text-[var(--terminal-text-muted)]">{copy}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="charts" className="grid gap-8 border-b border-[var(--terminal-border)] px-4 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)]">
              Why charts
            </p>
            <h2 className="mt-3 font-display text-[3.2rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)]">
              Read the match like price action.
            </h2>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-8 text-[var(--terminal-text)]">
              The app keeps football context, but replaces scattered stats with a visual model: probability lines, event annotations, draw parity, and a VIX-style shock index.
            </p>
            <div className="mt-6 grid gap-3 font-mono text-[0.74rem] font-semibold uppercase text-[var(--terminal-text)]">
              <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-[var(--terminal-blue)]" /> TradingView-style interaction model</span>
              <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[var(--terminal-green)]" /> Wallet-gated terminal access</span>
              <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#ff4b6e]" /> Event-driven match replay and alerts</span>
            </div>
          </div>
          <MiniTerminalChart />
        </section>

        <section id="access" className="px-4 py-14 lg:px-8">
          <div className="flex flex-col justify-between gap-5 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5 lg:flex-row lg:items-center">
            <div>
              <p className="font-mono text-[0.72rem] font-semibold uppercase text-[var(--terminal-green)]">
                Access protocol
              </p>
              <h2 className="mt-2 font-display text-[2.6rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)]">
                Connect wallet to enter the main app.
              </h2>
            </div>
            <Button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="h-12 cursor-pointer rounded-none border border-[var(--terminal-green)] bg-[var(--terminal-green)] px-5 font-mono text-[0.78rem] font-semibold uppercase text-[var(--terminal-inverse-fg)] shadow-none hover:bg-[var(--terminal-green)]"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        </section>
      </main>

      <ConnectWalletModal
        open={walletOpen}
        connected={wallet.isConnected}
        addressLabel={wallet.addressLabel}
        error={wallet.error}
        isConnecting={wallet.status === "connecting"}
        hasProvider={wallet.hasProvider}
        availableWallets={wallet.availableWallets}
        selectedWalletId={wallet.selectedWalletId}
        onClose={() => setWalletOpen(false)}
        onConnect={handleConnect}
        onSelectWallet={handleWalletSelection}
        onEnterApp={enterApp}
      />
    </div>
  );
}
