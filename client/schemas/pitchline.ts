import { z } from "zod";

export const fixtureDtoSchema = z.object({
  fixtureId: z.string(),
  homeName: z.string(),
  awayName: z.string(),
  homeId: z.string(),
  awayId: z.string(),
  kickOff: z.string(),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  phase: z.string().nullable(),
  minute: z.string().nullable(),
  homePct: z.number().nullable(),
  drawPct: z.number().nullable(),
  awayPct: z.number().nullable(),
});

export const fixturesResponseSchema = z.object({
  fixtures: z.array(fixtureDtoSchema),
});

export const matchResponseSchema = z.object({
  fixtureId: z.string(),
  homeName: z.string(),
  awayName: z.string(),
  homeScore: z.number(),
  awayScore: z.number(),
  phase: z.string(),
  minute: z.string(),
  homePct: z.number(),
  drawPct: z.number(),
  awayPct: z.number(),
  redCardActive: z.boolean(),
  kickOff: z.string(),
});

export const oddsSnapshotSchema = z.object({
  homePct: z.number(),
  drawPct: z.number(),
  awayPct: z.number(),
  timestamp: z.string(),
});

export const matchHistoryResponseSchema = z.object({
  fixtureId: z.string(),
  homeName: z.string(),
  awayName: z.string(),
  oddsHistory: z.array(oddsSnapshotSchema).nullable(),
  events: z.array(z.unknown()).nullable(),
});

export type BackendFixtureDto = z.infer<typeof fixtureDtoSchema>;
export type BackendMatchDto = z.infer<typeof matchResponseSchema>;
export type BackendMatchHistoryDto = z.infer<typeof matchHistoryResponseSchema>;
