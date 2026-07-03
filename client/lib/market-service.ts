import axios from "axios";
import { z } from "zod";

import { getMarketOverviewRows } from "./mock-data";

const marketRowSchema = z.object({
  fixture: z.object({
    fixtureId: z.string(),
    teamAName: z.string(),
    teamACode: z.string(),
    teamBName: z.string(),
    teamBCode: z.string(),
    competition: z.string(),
    stage: z.string(),
    kickoffUtc: z.string(),
    status: z.string(),
    phase: z.string(),
    minute: z.string(),
    scoreA: z.number(),
    scoreB: z.number(),
    leadProbability: z.number(),
  }),
  status: z.string(),
  statusLabel: z.string(),
  eventPair: z.string(),
  eventSubLabel: z.string(),
  scoreLine: z.string(),
  timeLabel: z.string(),
  probabilities: z.object({
    home: z.number(),
    draw: z.number(),
    away: z.number(),
  }),
  liquidity: z.string(),
  depth: z.string(),
  action: z.string(),
  actionTone: z.string(),
});

const marketRowsSchema = z.array(marketRowSchema);

export type MarketOverviewRow = z.infer<typeof marketRowSchema>;

const marketApi = axios.create({
  baseURL: "/api",
  adapter: async (config) => {
    if (config.url === "/markets") {
      return {
        data: getMarketOverviewRows(),
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    }

    return {
      data: null,
      status: 404,
      statusText: "Not Found",
      headers: {},
      config,
    };
  },
});

export async function fetchMarketOverviewRows() {
  const response = await marketApi.get("/markets");
  return marketRowsSchema.parse(response.data);
}
