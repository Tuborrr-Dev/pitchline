import { Suspense } from "react";
import { MarketOverview } from "@/components/market-overview";
import { getMarketOverviewRows } from "@/lib/mock-data";

export default function MarketsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <MarketOverview initialRows={getMarketOverviewRows()} />
    </Suspense>
  );
}
