import { queryOptions } from "@tanstack/react-query";

import type { MarketOverviewRow } from "@/schemas/market";
import { fetchMarketOverviewRows } from "@/services/market-service";

export const marketOverviewQueryKey = ["market-overview"] as const;

export function marketOverviewQueryOptions(initialRows?: MarketOverviewRow[]) {
  return queryOptions({
    queryKey: marketOverviewQueryKey,
    queryFn: fetchMarketOverviewRows,
    initialData: initialRows,
  });
}
