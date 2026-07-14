import { Suspense } from "react";

import { MarketOverview } from "@/components/market-overview";

export const dynamic = "force-dynamic";

export default function MarketSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <MarketOverview initialRows={[]} initialTab="settings" />
    </Suspense>
  );
}
