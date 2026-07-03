"use client";

import { useSyncExternalStore } from "react";

const WALLET_KEY = "pitchline.wallet.connected";
const WALLET_EVENT = "pitchline-wallet-change";
const listeners = new Set<() => void>();

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(WALLET_KEY) === "true";
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

export function useWalletConnected() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setWalletConnectedState(connected: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WALLET_KEY, String(connected));
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new Event(WALLET_EVENT));
}
