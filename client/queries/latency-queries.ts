import { queryOptions } from "@tanstack/react-query";

import { fetchLatency } from "@/services/latency-service";

export const latencyQueryKey = ["annotation-latency"] as const;

export function latencyQueryOptions() {
  return queryOptions({
    queryKey: latencyQueryKey,
    queryFn: fetchLatency,
    refetchInterval: 5000,
    retry: 1,
    staleTime: 3000,
  });
}
