import { z } from "zod";

import {
  fetchFinishedMarketOverviewRows as fetchPitchlineFinishedMarketOverviewRows,
  fetchMarketOverviewRows as fetchPitchlineMarketOverviewRows,
} from "./pitchline-service";

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

export async function fetchMarketOverviewRows() {
  const rows = await fetchPitchlineMarketOverviewRows();
  return marketRowsSchema.parse(rows);
}

export async function fetchFinishedMarketOverviewRows() {
  const rows = await fetchPitchlineFinishedMarketOverviewRows();
  return marketRowsSchema.parse(rows);
}
