"use client";

import { Activity, ArrowRight, BarChart3, LineChart, LockKeyhole, Wallet } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConnectWalletModal } from "@/components/landing-page/connect-wallet-modal";
import { MiniTerminalChart } from "@/components/landing-page/mini-terminal-chart";
import { Button } from "@/components/ui/button";
import { useWalletConnectModal } from "@/components/wallet-connect-provider";
import { WALLETCONNECT_WALLET_ID, connectWallet, selectWallet, useWallet } from "@/lib/wallet-session";

export function LandingPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [walletOpen, setWalletOpen] = useState(false);
  const wallet = useWallet();
  const walletConnect = useWalletConnectModal();
  const isDarkTheme = resolvedTheme === "dark";
  const heroImage = isDarkTheme
    ? "/images/pitchline-hero-football.png"
    : "/images/pitchline-hero-football-light.png";
  const heroImageClass = isDarkTheme ? "object-cover opacity-55" : "object-cover opacity-95";
  const heroOverlayClass = isDarkTheme
    ? "absolute inset-0 bg-[linear-gradient(90deg,#05080c_0%,rgba(5,8,12,0.86)_34%,rgba(5,8,12,0.42)_66%,#05080c_100%)]"
    : "absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.94)_0%,rgba(248,250,252,0.68)_36%,rgba(248,250,252,0.18)_72%,rgba(248,250,252,0.46)_100%)]";

  function enterApp() {
    router.push("/markets");
  }

  async function handleConnect() {
    if (wallet.selectedWalletId === WALLETCONNECT_WALLET_ID) {
      await walletConnect.openConnect();
      return;
    }

    await connectWallet();
  }

  async function handleWalletSelection(walletId: string) {
    selectWallet(walletId);

    if (walletId === WALLETCONNECT_WALLET_ID) {
      await walletConnect.openConnect();
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--background)] text-[var(--terminal-text)]">
      <main className="bg-[linear-gradient(90deg,var(--terminal-grid)_1px,transparent_1px),linear-gradient(var(--terminal-grid)_1px,transparent_1px)] bg-[size:28px_28px]">
        <section className="relative min-h-[calc(100vh-5.125rem)] overflow-hidden border-b border-[var(--terminal-border)]">
          <Image
            key={heroImage}
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
        connected={wallet.isConnected && wallet.isSupportedChain}
        wrongNetwork={wallet.isWrongNetwork}
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

