import { z } from "zod";

export const latencyResponseSchema = z.object({
  avg_latency_ms: z.number().nullable(),
});

export type LatencyResponse = z.infer<typeof latencyResponseSchema>;
