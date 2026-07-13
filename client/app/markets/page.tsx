import { Suspense } from "react";
import { MarketOverview } from "@/components/market-overview";
import { fetchMarketOverviewRows } from "@/lib/market-service";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const initialRows = await fetchMarketOverviewRows();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--background)]" />}>
      <MarketOverview initialRows={initialRows} />
    </Suspense>
  );
}
