"use client";

import { useEffect, useSyncExternalStore } from "react";

const WALLET_EVENT = "pitchline-wallet-change";
const WALLET_AUTH_KEY = "pitchline.wallet.authorized";
const WALLET_PROVIDER_KEY = "pitchline.wallet.provider";
const WALLET_REQUEST_TIMEOUT_MS = 15000;
const listeners = new Set<() => void>();

type WalletStatus = "idle" | "checking" | "connecting" | "connected" | "error";

type WalletSnapshot = {
  hasProvider: boolean;
  isConnected: boolean;
  address: string | null;
  chainId: string | null;
  status: WalletStatus;
  error: string | null;
  availableWallets: WalletOption[];
  selectedWalletId: string | null;
};

type RequestArguments = {
  method: string;
  params?: unknown[] | object;
};

type EthereumProvider = {
  request(args: RequestArguments): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isPhantom?: boolean;
  isTrust?: boolean;
};

type ProviderError = {
  code?: number;
  message?: string;
};

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip6963ProviderDetail = {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
};

export type WalletOption = {
  id: string;
  name: string;
  icon: string | null;
  rdns: string | null;
};

type WalletProviderRecord = WalletOption & {
  provider: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const defaultSnapshot: WalletSnapshot = {
  hasProvider: false,
  isConnected: false,
  address: null,
  chainId: null,
  status: "idle",
  error: null,
  availableWallets: [],
  selectedWalletId: null,
};

let snapshot = defaultSnapshot;
let initialized = false;
let activeConnectRequest: Promise<WalletSnapshot | null> | null = null;
const discoveredProviders = new Map<string, WalletProviderRecord>();
const subscribedProviders = new WeakSet<EthereumProvider>();

function emitChange() {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new Event(WALLET_EVENT));
}

function setSnapshot(nextSnapshot: WalletSnapshot) {
  snapshot = nextSnapshot;
  if (typeof window !== "undefined") {
    emitChange();
  }
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return defaultSnapshot;
}

function getAuthorizedFlag() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WALLET_AUTH_KEY) === "true";
}

function setAuthorizedFlag(authorized: boolean) {
  if (typeof window === "undefined") return;

  if (authorized) {
    window.localStorage.setItem(WALLET_AUTH_KEY, "true");
    return;
  }

  window.localStorage.removeItem(WALLET_AUTH_KEY);
}

function getSelectedWalletId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WALLET_PROVIDER_KEY);
}

function persistSelectedWalletId(walletId: string | null) {
  if (typeof window === "undefined") return;

  if (walletId) {
    window.localStorage.setItem(WALLET_PROVIDER_KEY, walletId);
    return;
  }

  window.localStorage.removeItem(WALLET_PROVIDER_KEY);
}

function getDisconnectedSnapshot(hasProvider: boolean, error: string | null = null): WalletSnapshot {
  return {
    hasProvider,
    isConnected: false,
    address: null,
    chainId: null,
    status: error ? "error" : "idle",
    error,
    availableWallets: snapshot.availableWallets,
    selectedWalletId: snapshot.selectedWalletId,
  };
}

function formatWalletAddress(address: string | null) {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function slugifyWalletId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function inferLegacyWalletName(provider: EthereumProvider) {
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isRabby) return "Rabby";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isPhantom) return "Phantom";
  if (provider.isTrust) return "Trust Wallet";
  return "Browser Wallet";
}

function inferLegacyWalletRdns(provider: EthereumProvider) {
  if (provider.isMetaMask) return "io.metamask";
  if (provider.isRabby) return "io.rabby";
  if (provider.isCoinbaseWallet) return "com.coinbase.wallet";
  if (provider.isPhantom) return "app.phantom";
  if (provider.isTrust) return "com.trustwallet";
  return null;
}

function buildWalletOption(record: WalletProviderRecord): WalletOption {
  return {
    id: record.id,
    name: record.name,
    icon: record.icon,
    rdns: record.rdns,
  };
}

function getAvailableWallets() {
  return Array.from(discoveredProviders.values())
    .map(buildWalletOption)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function refreshWalletCatalog(nextError: string | null = snapshot.error) {
  const availableWallets = getAvailableWallets();
  const selectedWalletId = getSelectedWalletId();
  const hasSelectedWallet = selectedWalletId ? discoveredProviders.has(selectedWalletId) : false;
  const resolvedSelectedWalletId = hasSelectedWallet ? selectedWalletId : null;

  if (selectedWalletId && !hasSelectedWallet) {
    persistSelectedWalletId(null);
  }

  setSnapshot({
    ...snapshot,
    hasProvider: availableWallets.length > 0,
    availableWallets,
    selectedWalletId: resolvedSelectedWalletId,
    error: nextError,
  });
}

function selectDefaultWalletIfNeeded() {
  const selectedWalletId = getSelectedWalletId();
  if (selectedWalletId && discoveredProviders.has(selectedWalletId)) return;

  const firstWallet = getAvailableWallets()[0];
  if (!firstWallet) return;

  persistSelectedWalletId(firstWallet.id);
}

function getActiveProviderRecord() {
  const selectedWalletId = getSelectedWalletId();

  if (selectedWalletId && discoveredProviders.has(selectedWalletId)) {
    return discoveredProviders.get(selectedWalletId) ?? null;
  }

  if (discoveredProviders.size === 1) {
    const [onlyProvider] = discoveredProviders.values();
    persistSelectedWalletId(onlyProvider.id);
    return onlyProvider;
  }

  return null;
}

function normalizeProviderError(error: unknown) {
  const providerError = error as ProviderError | undefined;
  const message = providerError?.message?.trim();

  if (providerError?.code === 4001) {
    return "Wallet connection request was rejected.";
  }

  if (providerError?.code === -32002) {
    return "A wallet request is already open. Check your wallet extension.";
  }

  if (message?.toLowerCase().includes("unexpected error")) {
    return "Wallet extension returned an unexpected error. Retry the request or reopen the wallet extension.";
  }

  if (message) {
    return message;
  }

  return "Wallet connection failed. Try again.";
}

async function requestWithTimeout(provider: EthereumProvider, args: RequestArguments, timeoutMessage: string) {
  return Promise.race([
    provider.request(args),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(timeoutMessage)), WALLET_REQUEST_TIMEOUT_MS);
    }),
  ]);
}

function subscribeToProvider(providerId: string, provider: EthereumProvider) {
  if (!provider.on || subscribedProviders.has(provider)) return;
  subscribedProviders.add(provider);

  const handleAccountsChanged = (nextAccounts: unknown) => {
    if (getSelectedWalletId() !== providerId) return;

    const accounts = Array.isArray(nextAccounts)
      ? nextAccounts.filter((account): account is string => typeof account === "string")
      : [];

    if (accounts.length === 0) {
      setAuthorizedFlag(false);
      setSnapshot(getDisconnectedSnapshot(true));
      return;
    }

    if (!getAuthorizedFlag()) {
      setSnapshot(getDisconnectedSnapshot(true));
      return;
    }

    setSnapshot({
      ...snapshot,
      hasProvider: true,
      isConnected: true,
      address: accounts[0] ?? null,
      status: "connected",
      error: null,
    });
  };

  const handleChainChanged = (nextChainId: unknown) => {
    if (getSelectedWalletId() !== providerId || typeof nextChainId !== "string") return;

    setSnapshot({
      ...snapshot,
      hasProvider: true,
      chainId: nextChainId,
      status: snapshot.isConnected ? "connected" : snapshot.status,
      error: null,
    });
  };

  const handleDisconnect = () => {
    if (getSelectedWalletId() !== providerId) return;

    setAuthorizedFlag(false);
    setSnapshot(getDisconnectedSnapshot(true));
  };

  provider.on("accountsChanged", handleAccountsChanged);
  provider.on("chainChanged", handleChainChanged);
  provider.on("disconnect", handleDisconnect);
}

function registerProvider(record: WalletProviderRecord) {
  const existing = discoveredProviders.get(record.id);
  if (existing?.provider === record.provider) return;

  discoveredProviders.set(record.id, record);
  subscribeToProvider(record.id, record.provider);
}

function registerEip6963Provider(detail: Eip6963ProviderDetail) {
  const id = detail.info.rdns || slugifyWalletId(detail.info.name) || detail.info.uuid;

  registerProvider({
    id,
    name: detail.info.name,
    icon: detail.info.icon || null,
    rdns: detail.info.rdns || null,
    provider: detail.provider,
  });
}

function registerLegacyProvider(provider: EthereumProvider) {
  const name = inferLegacyWalletName(provider);
  const rdns = inferLegacyWalletRdns(provider);
  const id = rdns || slugifyWalletId(name);

  registerProvider({
    id,
    name,
    icon: null,
    rdns,
    provider,
  });
}

async function syncWalletState() {
  const providerRecord = getActiveProviderRecord();
  const provider = providerRecord?.provider;

  if (!provider) {
    setSnapshot(
      getDisconnectedSnapshot(
        discoveredProviders.size > 0,
        discoveredProviders.size > 1 ? "Select a wallet provider to continue." : null,
      ),
    );
    return;
  }

  setSnapshot({
    ...snapshot,
    hasProvider: true,
    selectedWalletId: providerRecord.id,
    status: snapshot.isConnected ? "connected" : "checking",
    error: null,
  });

  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    const authorized = getAuthorizedFlag();

    if (!authorized || accounts.length === 0) {
      setSnapshot(getDisconnectedSnapshot(true));
      return;
    }

    const chainId = (await provider.request({ method: "eth_chainId" })) as string;

    setSnapshot({
      ...snapshot,
      hasProvider: true,
      isConnected: true,
      address: accounts[0] ?? null,
      chainId,
      status: "connected",
      error: null,
      selectedWalletId: providerRecord.id,
    });
  } catch {
    setSnapshot(getDisconnectedSnapshot(true, "Unable to read wallet state."));
  }
}

function initializeWalletStore() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("eip6963:announceProvider", (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail?.provider || !detail?.info) return;

    registerEip6963Provider(detail);
    selectDefaultWalletIfNeeded();
    refreshWalletCatalog();
    void syncWalletState();
  });

  const legacyProviders = window.ethereum?.providers?.length
    ? window.ethereum.providers
    : window.ethereum
      ? [window.ethereum]
      : [];

  legacyProviders.forEach(registerLegacyProvider);
  selectDefaultWalletIfNeeded();
  refreshWalletCatalog();

  window.dispatchEvent(new Event("eip6963:requestProvider"));
  void syncWalletState();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage() {
    listener();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(WALLET_EVENT, handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(WALLET_EVENT, handleStorage);
  };
}

export function useWallet() {
  const wallet = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initializeWalletStore();
  }, []);

  return {
    ...wallet,
    addressLabel: formatWalletAddress(wallet.address),
  };
}

export function selectWallet(walletId: string) {
  if (!discoveredProviders.has(walletId)) {
    setSnapshot({
      ...snapshot,
      error: "Selected wallet provider is no longer available.",
    });
    return;
  }

  persistSelectedWalletId(walletId);
  setAuthorizedFlag(false);
  setSnapshot({
    ...snapshot,
    isConnected: false,
    address: null,
    chainId: null,
    status: "idle",
    error: null,
    selectedWalletId: walletId,
    availableWallets: getAvailableWallets(),
    hasProvider: discoveredProviders.size > 0,
  });
}

export async function connectWallet() {
  if (activeConnectRequest) {
    return activeConnectRequest;
  }

  const providerRecord = getActiveProviderRecord();
  const provider = providerRecord?.provider;

  if (!provider) {
    setSnapshot(
      getDisconnectedSnapshot(
        discoveredProviders.size > 0,
        discoveredProviders.size > 1
          ? "Select a wallet provider first."
          : "No EVM wallet detected. Install MetaMask or another browser wallet.",
      ),
    );
    return null;
  }

  setSnapshot({
    ...snapshot,
    hasProvider: true,
    selectedWalletId: providerRecord.id,
    status: "connecting",
    error: null,
  });

  const request = (async () => {
    try {
      const accounts = (await requestWithTimeout(
        provider,
        { method: "eth_requestAccounts" },
        "Wallet connection timed out. Check the wallet extension and try again.",
      )) as string[];

      if (accounts.length === 0) {
        setSnapshot(getDisconnectedSnapshot(true, "Wallet connection was cancelled."));
        return null;
      }

      const chainId = (await requestWithTimeout(
        provider,
        { method: "eth_chainId" },
        "Wallet connected, but reading the active network timed out.",
      )) as string;
      setAuthorizedFlag(true);

      const nextSnapshot: WalletSnapshot = {
        hasProvider: true,
        isConnected: true,
        address: accounts[0] ?? null,
        chainId,
        status: "connected",
        error: null,
        availableWallets: getAvailableWallets(),
        selectedWalletId: providerRecord.id,
      };

      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      const message = normalizeProviderError(error);

      setAuthorizedFlag(false);
      setSnapshot(getDisconnectedSnapshot(true, message));
      return null;
    } finally {
      activeConnectRequest = null;
    }
  })();

  activeConnectRequest = request;
  return request;
}

export function disconnectWallet() {
  setAuthorizedFlag(false);
  setSnapshot(getDisconnectedSnapshot(discoveredProviders.size > 0));
}
