import { getJson } from "@/services/pitchline-http";
import { fixturesResponseSchema } from "@/schemas/pitchline";

export async function fetchFixtureIndex() {
  const response = await getJson("/api/Fixtures", fixturesResponseSchema);
  return response.fixtures;
}
