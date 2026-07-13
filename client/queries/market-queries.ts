import { queryOptions } from "@tanstack/react-query";

import type { MarketOverviewRow } from "@/schemas/market";
import {
  fetchFinishedMarketOverviewRows,
  fetchMarketOverviewRows,
} from "@/services/market-service";

export const marketOverviewQueryKey = ["market-overview"] as const;
export const finishedMarketOverviewQueryKey = ["market-overview-finished"] as const;

export function marketOverviewQueryOptions(initialRows?: MarketOverviewRow[]) {
  return queryOptions({
    queryKey: marketOverviewQueryKey,
    queryFn: fetchMarketOverviewRows,
    initialData: initialRows,
  });
}

export function finishedMarketOverviewQueryOptions() {
  return queryOptions({
    queryKey: finishedMarketOverviewQueryKey,
    queryFn: fetchFinishedMarketOverviewRows,
  });
}
