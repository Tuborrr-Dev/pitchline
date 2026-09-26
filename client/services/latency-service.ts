import { latencyResponseSchema } from "@/schemas/latency";

export async function fetchLatency() {
  const response = await fetch("/api/annotation-latency", {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Annotation latency request failed: ${response.status}`);
  }

  return latencyResponseSchema.parse(await response.json());
}
