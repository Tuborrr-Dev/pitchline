import { NextResponse } from "next/server";

import { ANNOTATION_API_BASE_URL } from "@/config/api";
import { latencyResponseSchema } from "@/schemas/latency";

export async function GET() {
  try {
    const response = await fetch(`${ANNOTATION_API_BASE_URL}/latency`, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { avg_latency_ms: null },
        { status: response.status },
      );
    }

    const data = latencyResponseSchema.parse(await response.json());
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ avg_latency_ms: null }, { status: 502 });
  }
}
