import { ANNOTATION_API_BASE_URL } from "@/config/api";
import { latencyResponseSchema } from "@/schemas/latency";

export async function fetchLatency() {
  const response = await fetch(`${ANNOTATION_API_BASE_URL}/latency`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Annotation latency request failed: ${response.status}`);
  }

  return latencyResponseSchema.parse(await response.json());
}
