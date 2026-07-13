import { Suspense } from "react";
import { MarketOverview } from "@/components/market-overview";
import { fetchMarketOverviewRows } from "@/services/market-service";

export default async function MarketsPage() {
  const initialRows = await fetchMarketOverviewRows();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <MarketOverview initialRows={initialRows} />
    </Suspense>
  );
}
