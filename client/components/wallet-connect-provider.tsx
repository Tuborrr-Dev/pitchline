"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { createAppKit, useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitState } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { WagmiProvider, useDisconnect } from "wagmi";

import {
  REOWN_PROJECT_ID,
  pitchlineEvmNetworks,
  walletConnectEnabled,
  walletConnectMetadata,
} from "@/config/walletconnect";
import {
  resetWalletConnectIfConnecting,
  setWalletConnectAvailability,
  setWalletConnectError,
  setWalletConnectOpening,
  syncWalletConnectState,
} from "@/lib/wallet-session";

type WalletConnectModalContextValue = {
  enabled: boolean;
  disconnect: () => Promise<void>;
  openConnect: () => Promise<boolean | null>;
};

const disabledWalletConnectModal: WalletConnectModalContextValue = {
  enabled: false,
  disconnect: async () => {},
  openConnect: async () => {
    setWalletConnectError("WalletConnect is not configured. Add NEXT_PUBLIC_REOWN_PROJECT_ID.");
    return null;
  },
};

const WalletConnectModalContext = createContext<WalletConnectModalContextValue>(disabledWalletConnectModal);

const wagmiAdapter = walletConnectEnabled
  ? new WagmiAdapter({
      networks: pitchlineEvmNetworks,
      projectId: REOWN_PROJECT_ID,
      ssr: true,
    })
  : null;

if (walletConnectEnabled && wagmiAdapter) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: pitchlineEvmNetworks,
    projectId: REOWN_PROJECT_ID,
    metadata: walletConnectMetadata,
    features: {
      analytics: false,
      email: false,
      socials: [],
    },
  });
}

function formatAppKitChainId(chainId: string | number | undefined) {
  if (chainId == null) return null;
  if (typeof chainId === "number") return `0x${chainId.toString(16)}`;
  if (/^\d+$/.test(chainId)) return `0x${Number(chainId).toString(16)}`;
  return chainId;
}

function WalletConnectController({ children }: { children: React.ReactNode }) {
  const { open } = useAppKit();
  const { disconnectAsync } = useDisconnect();
  const account = useAppKitAccount({ namespace: "eip155" });
  const network = useAppKitNetwork();
  const appKitState = useAppKitState();

  useEffect(() => {
    syncWalletConnectState({
      address: account.address ?? null,
      chainId: formatAppKitChainId(network.chainId),
      isConnected: account.isConnected,
      status: account.status,
    });
  }, [account.address, account.isConnected, account.status, network.chainId]);

  useEffect(() => {
    if (appKitState.open || account.isConnected) return;
    resetWalletConnectIfConnecting();
  }, [account.isConnected, appKitState.open]);

  const value = useMemo<WalletConnectModalContextValue>(
    () => ({
      enabled: true,
      disconnect: async () => {
        try {
          await disconnectAsync();
        } catch {
          // Local wallet state is still cleared by the caller.
        }
      },
      openConnect: async () => {
        setWalletConnectOpening();
        try {
          await open({ view: "AllWallets", namespace: "eip155" });
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "WalletConnect failed to open.";
          setWalletConnectError(message);
          return null;
        }
      },
    }),
    [disconnectAsync, open],
  );

  return <WalletConnectModalContext.Provider value={value}>{children}</WalletConnectModalContext.Provider>;
}

export function useWalletConnectModal() {
  return useContext(WalletConnectModalContext);
}

export function WalletConnectProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setWalletConnectAvailability(walletConnectEnabled);
  }, []);

  if (!walletConnectEnabled || !wagmiAdapter) {
    return <WalletConnectModalContext.Provider value={disabledWalletConnectModal}>{children}</WalletConnectModalContext.Provider>;
  }

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <WalletConnectController>{children}</WalletConnectController>
    </WagmiProvider>
  );
}

