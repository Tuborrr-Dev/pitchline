"use client";

import { LockKeyhole } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useWallet } from "@/lib/wallet-session";

function isProtectedPath(pathname: string) {
  return pathname !== "/";
}

export function WalletRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const wallet = useWallet();
  const [readyPathname, setReadyPathname] = useState<string | null>(null);
  const protectedPath = useMemo(() => isProtectedPath(pathname), [pathname]);
  const canAccess = wallet.isConnected && wallet.isSupportedChain;

  const canEvaluateWallet = readyPathname === pathname;

  useEffect(() => {
    const timeout = window.setTimeout(() => setReadyPathname(pathname), 350);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!protectedPath || !canEvaluateWallet) return;
    if (wallet.status === "checking" || wallet.status === "connecting") return;
    if (canAccess) return;

    router.replace("/");
  }, [canAccess, canEvaluateWallet, protectedPath, router, wallet.status]);

  if (!protectedPath || canAccess) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full items-center justify-center bg-[var(--terminal-bg)] px-4 text-[var(--terminal-text)]">
      <div className="max-w-sm border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center border border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="mt-4 font-display text-[1.8rem] font-bold uppercase text-[var(--terminal-text-strong)]">
          Wallet required
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--terminal-text-muted)]">
          Connect your wallet to access market pages.
        </p>
      </div>
    </div>
  );
}
