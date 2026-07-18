import { z } from "zod";

export const latencyResponseSchema = z.object({
  avg_latency_ms: z.coerce.number().finite().nullable(),
});

export type LatencyResponse = z.infer<typeof latencyResponseSchema>;
