import { AxiosError } from "axios";
import { z } from "zod";

import { apiClient } from "@/config/api";

export async function getJson<T>(path: string, schema: z.ZodType<T>) {
  try {
    const response = await apiClient.get(path);
    return schema.parse(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Pitchline API request failed: ${error.response?.status ?? "network"} ${path}`);
    }

    throw error;
  }
}
