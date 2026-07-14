import { Suspense } from "react";

import { MarketOverview } from "@/components/market-overview";
import { fetchFinishedMarketOverviewRows } from "@/services/market-service";

export const dynamic = "force-dynamic";

export default async function MarketHistoryPage() {
  const initialRows = await fetchFinishedMarketOverviewRows();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <MarketOverview initialRows={initialRows} initialTab="history" />
    </Suspense>
  );
}
