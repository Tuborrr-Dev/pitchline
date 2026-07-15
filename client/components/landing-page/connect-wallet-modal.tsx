"use client";

import { ArrowRight, Check, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConnectWalletModal({
  open,
  connected,
  wrongNetwork,
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
  wrongNetwork: boolean;
  addressLabel: string | null;
  error: string | null;
  isConnecting: boolean;
  hasProvider: boolean;
  availableWallets: Array<{ id: string; name: string; source?: string }>;
  selectedWalletId: string | null;
  onClose: () => void;
  onConnect: () => Promise<void>;
  onSelectWallet: (walletId: string) => void;
  onEnterApp: () => void;
}) {
  const hasConnectionError = Boolean(error) && !connected && !wrongNetwork;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
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
                  <span className={cn("flex h-10 w-10 items-center justify-center border", connected ? "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]" : wrongNetwork || hasConnectionError ? "border-red-500/30 bg-red-500/10 text-[#d71945]" : "border-[var(--terminal-border)] text-[var(--terminal-text-muted)]")}>
                    {connected ? <Check className="h-5 w-5" /> : wrongNetwork || hasConnectionError ? <X className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
                  </span>
                  <div>
                    <p className="font-display text-[1.35rem] font-bold uppercase text-[var(--terminal-text-strong)]">
                      {connected ? addressLabel : wrongNetwork ? "Wrong Network" : hasConnectionError ? "Connection Error" : hasProvider ? "No Wallet Connected" : "Wallet Not Found"}
                    </p>
                    <p className="font-mono text-[0.7rem] uppercase text-[var(--terminal-text-muted)]">
                      {connected
                        ? "Session unlocked"
                        : wrongNetwork
                          ? "Switch to Ethereum mainnet"
                        : hasConnectionError
                          ? "Retry the wallet request"
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
                  : wrongNetwork
                    ? "Switch Network"
                  : hasConnectionError
                    ? "Retry Connection"
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

