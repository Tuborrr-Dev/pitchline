"use client";

import { LogOut, Wallet } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { WalletDisconnectConfirmation } from "@/components/wallet-disconnect-confirmation";
import { cn } from "@/lib/utils";
import type { useWallet } from "@/lib/wallet-session";

type WalletState = ReturnType<typeof useWallet>;

export function WalletControl({
  compactMobile = false,
  fullWidth = false,
  isLanding,
  mobileIconVisibility,
  mobileSearchOpen,
  onConnect,
  onDisconnect,
  onSelectWallet,
  wallet,
  walletPickerOpen,
}: {
  compactMobile?: boolean;
  fullWidth?: boolean;
  isLanding: boolean;
  mobileIconVisibility: string;
  mobileSearchOpen: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSelectWallet: (walletId: string) => void;
  wallet: WalletState;
  walletPickerOpen: boolean;
}) {
  const isWrongNetwork = wallet.isConnected && !wallet.isSupportedChain;
  const hasConnectionError = wallet.status === "error" && !isWrongNetwork && Boolean(wallet.error);

  return (
    <motion.div layout className={cn("flex items-center gap-2", fullWidth && "w-full flex-col items-stretch")}>
      <Button
        type="button"
        onClick={onConnect}
        title={isWrongNetwork ? wallet.error ?? `Switch to ${wallet.requiredNetworkName}` : undefined}
        disabled={wallet.status === "checking" || wallet.status === "connecting"}
        className={cn(
          "h-10 min-w-0 cursor-pointer rounded-none border px-3 font-mono text-[0.68rem] font-semibold uppercase shadow-none sm:h-11 sm:px-4 sm:text-[0.78rem]",
          fullWidth && "w-full justify-center",
          compactMobile && !isLanding && "w-10 px-0 sm:w-auto sm:px-4",
          mobileSearchOpen && !isLanding && "w-10 px-0 sm:w-auto sm:px-4",
          isWrongNetwork
            ? "border-[#ff4b6e] bg-red-500/10 text-[#ff4b6e] hover:bg-red-500/15"
            : hasConnectionError
              ? "border-[#ff4b6e] bg-red-500/10 text-[#ff4b6e] hover:bg-red-500/15"
            : wallet.isConnected
            ? "border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--terminal-inverse-fg)]"
            : "border-[var(--terminal-green)] bg-transparent text-[var(--terminal-green)] hover:bg-emerald-500/10",
          (wallet.status === "checking" || wallet.status === "connecting") && "cursor-wait opacity-80",
        )}
      >
        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center", mobileIconVisibility)}>
          <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isWrongNetwork ? "wrong-network" : hasConnectionError ? "wallet-error" : wallet.isConnected ? "connected" : wallet.status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className={cn((mobileSearchOpen || compactMobile) && !isLanding ? "hidden sm:inline" : "inline")}
          >
            {isWrongNetwork
              ? "Wrong Network"
              : hasConnectionError
                ? "Wallet Error"
              : wallet.isConnected
              ? wallet.addressLabel
              : wallet.status === "checking"
                ? "Checking..."
                : wallet.status === "connecting"
                  ? "Connecting..."
                  : wallet.availableWallets.length > 1
                    ? "Choose Wallet"
                    : wallet.hasProvider
                      ? "Connect Wallet"
                      : "Install Wallet"}
          </motion.span>
        </AnimatePresence>
      </Button>
      {wallet.isConnected ? (
        <WalletDisconnectConfirmation
          className={cn(
            "h-10 cursor-pointer rounded-none border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 font-mono text-[0.68rem] font-semibold uppercase text-[var(--terminal-text)] shadow-none hover:bg-[var(--terminal-hover)] sm:h-11 sm:px-4 sm:text-[0.78rem]",
            fullWidth && "w-full justify-center",
          )}
          onConfirm={onDisconnect}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className={cn((mobileSearchOpen || compactMobile) && !isLanding ? "hidden sm:inline" : "inline")}>
            Disconnect
          </span>
        </WalletDisconnectConfirmation>
      ) : null}
      {!wallet.isConnected && walletPickerOpen && wallet.availableWallets.length > 1 ? (
        <div className="absolute right-0 top-[calc(100%+0.45rem)] z-50 min-w-64 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-[0_18px_40px_var(--terminal-shadow)]">
          <p className="border-b border-[var(--terminal-border)] px-3 py-2 font-mono text-[0.58rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
            Choose wallet
          </p>
          {wallet.availableWallets.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => onSelectWallet(provider.id)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between border-b border-[var(--terminal-line)] px-3 py-2 text-left font-mono uppercase hover:bg-[var(--terminal-hover)]",
                wallet.selectedWalletId === provider.id && "bg-[var(--terminal-hover)]",
              )}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[0.72rem] font-semibold text-[var(--terminal-text-strong)]">{provider.name}</span>
                <span className="text-[0.55rem] text-[var(--terminal-text-muted)]">
                  {provider.source === "walletconnect" ? "Mobile app or QR" : "Browser extension"}
                </span>
              </span>
              <span className="text-[0.58rem] text-[var(--terminal-text-muted)]">
                {wallet.selectedWalletId === provider.id ? "Selected" : "Use"}
              </span>
            </button>
          ))}
          {wallet.error ? (
            <p className="px-3 py-2 font-mono text-[0.58rem] uppercase text-[#ff9aa9]">
              {wallet.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

