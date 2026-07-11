import { z } from "zod";

import type {
  ConnectionState,
  Fixture,
  LiveMatchState,
  MatchEvent,
  MatchStatus,
  ProbabilityPoint,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_PITCHLINE_API_BASE_URL ?? "https://pitchline.onrender.com";

const fixtureDtoSchema = z.object({
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

const fixturesResponseSchema = z.object({
  fixtures: z.array(fixtureDtoSchema),
});

const matchResponseSchema = z.object({
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

const oddsSnapshotSchema = z.object({
  homePct: z.number(),
  drawPct: z.number(),
  awayPct: z.number(),
  timestamp: z.string(),
});

const matchHistoryResponseSchema = z.object({
  fixtureId: z.string(),
  homeName: z.string(),
  awayName: z.string(),
  oddsHistory: z.array(oddsSnapshotSchema).nullable(),
  events: z.array(z.unknown()).nullable(),
});

export type BackendFixtureDto = z.infer<typeof fixtureDtoSchema>;
export type BackendMatchDto = z.infer<typeof matchResponseSchema>;
type BackendMatchHistoryDto = z.infer<typeof matchHistoryResponseSchema>;

const teamCodeOverrides: Record<string, string> = {
  Argentina: "ARG",
  Belgium: "BEL",
  Brazil: "BRA",
  England: "ENG",
  France: "FRA",
  Germany: "GER",
  Japan: "JPN",
  Mexico: "MEX",
  Nigeria: "NGA",
  Norway: "NOR",
  Portugal: "POR",
  "Saudi Arabia": "KSA",
  "South Korea": "KOR",
  Spain: "ESP",
  Switzerland: "SUI",
  "United States": "USA",
  Uruguay: "URU",
};

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function deriveTeamCode(name: string) {
  const override = teamCodeOverrides[name];
  if (override) return override;

  const letters = name
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (letters.length >= 2) {
    return `${letters[0][0] ?? ""}${letters[1][0] ?? ""}${letters[1][1] ?? ""}`.toUpperCase();
  }

  return name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "CLB";
}

function parseMinuteNumber(minute: string) {
  return Number.parseInt(minute.replace(/\D/g, ""), 10) || 0;
}

function formatUtcKickoff(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(kickoffUtc));
}

function toMatchStatus(phase: string | null | undefined) {
  const value = (phase ?? "").toLowerCase();
  if (value.includes("scheduled")) return "upcoming" satisfies MatchStatus;
  if (
    value.includes("finished") ||
    value.includes("abandoned") ||
    value.includes("cancelled")
  ) {
    return "finished" satisfies MatchStatus;
  }

  return "live" satisfies MatchStatus;
}

function formatMinuteLabel(status: MatchStatus, minute: string | null | undefined, kickoffUtc: string) {
  if (status === "upcoming") {
    return `KO ${formatUtcKickoff(kickoffUtc)} UTC`;
  }

  const cleanMinute = (minute ?? "").trim();
  if (!cleanMinute) {
    return status === "finished" ? "FT" : "0'";
  }

  return cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`;
}

function buildFixtureMeta(status: MatchStatus, kickoffUtc: string, phase: string | null | undefined) {
  if (status === "upcoming") {
    return {
      competition: "Scheduled Market",
      stage: `Kickoff ${formatUtcKickoff(kickoffUtc)} UTC`,
    };
  }

  if (status === "finished") {
    return {
      competition: "Settled Market",
      stage: phase?.trim() || "Full Time",
    };
  }

  return {
    competition: "Live Market",
    stage: `Kickoff ${formatUtcKickoff(kickoffUtc)} UTC`,
  };
}

function createFixtureFromDto(dto: BackendFixtureDto | BackendMatchDto) {
  const status = toMatchStatus(dto.phase);
  const teamACode = deriveTeamCode(dto.homeName);
  const teamBCode = deriveTeamCode(dto.awayName);
  const meta = buildFixtureMeta(status, dto.kickOff, dto.phase);

  return {
    fixtureId: dto.fixtureId,
    teamAName: dto.homeName,
    teamACode,
    teamBName: dto.awayName,
    teamBCode,
    competition: meta.competition,
    stage: meta.stage,
    kickoffUtc: dto.kickOff,
    status,
    phase: dto.phase?.trim() || (status === "finished" ? "Finished" : "Live"),
    minute: formatMinuteLabel(status, dto.minute, dto.kickOff),
    scoreA: dto.homeScore ?? 0,
    scoreB: dto.awayScore ?? 0,
    leadProbability: Math.max(dto.homePct ?? 0, dto.awayPct ?? 0),
  } satisfies Fixture;
}

function buildScoreLine(fixture: Fixture) {
  return `${fixture.scoreA} - ${fixture.scoreB}`;
}

function buildTimeLabel(fixture: Fixture) {
  if (fixture.status === "upcoming") {
    return fixture.minute;
  }

  return `${fixture.phase} / ${fixture.minute}`;
}

function buildMarketPlaceholder(fixture: Fixture) {
  if (fixture.status === "live") {
    return { liquidity: fixture.phase, depth: fixture.minute, action: "TRACK" };
  }

  if (fixture.status === "finished") {
    return { liquidity: "FINAL", depth: "Settled", action: "RECAP" };
  }

  return { liquidity: "READY", depth: formatUtcKickoff(fixture.kickoffUtc), action: "WATCH" };
}

function seedHistoryFromCurrentState(
  fixture: Fixture,
  currentProbabilities: LiveMatchState["currentProbabilities"],
  timestamp: string,
) {
  const currentMinute = Math.max(0, parseMinuteNumber(fixture.minute));
  const kickoff = new Date(fixture.kickoffUtc);
  const kickoffSeed = Number.isNaN(kickoff.getTime())
    ? new Date(Date.now() - 60_000)
    : kickoff;
  const kickoffPoint = {
    timestamp: kickoffSeed.toISOString(),
    minuteLabel: "0'",
    teamA: currentProbabilities.teamA,
    draw: currentProbabilities.draw,
    teamB: currentProbabilities.teamB,
  } satisfies ProbabilityPoint;
  const currentPoint = {
    timestamp,
    minuteLabel: currentMinute > 0 ? `${currentMinute}'` : fixture.minute,
    teamA: currentProbabilities.teamA,
    draw: currentProbabilities.draw,
    teamB: currentProbabilities.teamB,
  } satisfies ProbabilityPoint;

  if (kickoffPoint.timestamp === currentPoint.timestamp) {
    return [currentPoint];
  }

  return [kickoffPoint, currentPoint];
}

function isUsableHistoryTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() > 2000;
}

function historyToProbabilityPoints(
  history: BackendMatchHistoryDto | null,
  fixture: Fixture,
  fallbackProbabilities: LiveMatchState["currentProbabilities"],
) {
  const oddsHistory = history?.oddsHistory?.filter((point) => isUsableHistoryTimestamp(point.timestamp)) ?? [];

  if (oddsHistory.length === 0) {
    return seedHistoryFromCurrentState(
      fixture,
      fallbackProbabilities,
      new Date().toISOString(),
    );
  }

  return oddsHistory.map((point) => {
    const elapsedMinutes = Math.max(
      0,
      Math.round(
        (new Date(point.timestamp).getTime() - new Date(fixture.kickoffUtc).getTime()) / 60_000,
      ),
    );

    return {
      timestamp: point.timestamp,
      minuteLabel: `${elapsedMinutes}'`,
      teamA: point.homePct,
      draw: point.drawPct,
      teamB: point.awayPct,
    } satisfies ProbabilityPoint;
  });
}

export function createSystemEvent(
  fixture: Fixture,
  label: string,
  detailLabel: string,
  timestamp: string,
  minuteLabel?: string,
): MatchEvent {
  return {
    eventId: `${fixture.fixtureId}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}`,
    fixtureId: fixture.fixtureId,
    type: "status",
    minuteLabel: minuteLabel ?? (fixture.status === "live" ? fixture.minute : "PRE"),
    timestamp,
    label,
    detailLabel,
    side: "draw",
    importance: "low",
  };
}

function createInitialEvents(fixture: Fixture) {
  const timestamp = new Date().toISOString();
  if (fixture.status !== "live") {
    return [
      createSystemEvent(
        fixture,
        "Match monitoring armed",
        "Live odds and score updates will appear here once the fixture goes in-play.",
        timestamp,
        "PRE",
      ),
    ];
  }

  return [
    createSystemEvent(
      fixture,
      "Live odds tracking active",
      "Connected to the backend feed. The event rail will show score-led moments first.",
      timestamp,
      fixture.minute,
    ),
  ];
}

async function getJson<T>(path: string, schema: z.ZodType<T>) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Pitchline API request failed: ${response.status} ${path}`);
  }

  const json = await response.json();
  return schema.parse(json);
}

export async function fetchFixtureIndex() {
  const response = await getJson("/api/Fixtures", fixturesResponseSchema);
  return response.fixtures;
}

export async function fetchMarketOverviewRows() {
  const fixtures = await fetchFixtureIndex();

  return fixtures.map((dto) => {
    const fixture = createFixtureFromDto(dto);
    const placeholders = buildMarketPlaceholder(fixture);

    return {
      fixture,
      status: fixture.status,
      statusLabel:
        fixture.status === "live" ? "LIVE" : fixture.status === "finished" ? "FINAL" : "SCHEDULED",
      eventPair: `${fixture.teamACode} VS ${fixture.teamBCode}`,
      eventSubLabel: `${fixture.competition} · ${fixture.stage}`,
      scoreLine: buildScoreLine(fixture),
      timeLabel: buildTimeLabel(fixture),
      probabilities: {
        home: dto.homePct ?? 0,
        draw: dto.drawPct ?? 0,
        away: dto.awayPct ?? 0,
      },
      liquidity: placeholders.liquidity,
      depth: placeholders.depth,
      action: placeholders.action,
      actionTone: fixture.status === "live" ? "primary" : "secondary",
    };
  });
}

export async function fetchInitialLiveMatchState(fixtureId: string) {
  const fixtures = await fetchFixtureIndex();
  const fixtureMeta = fixtures.find((fixture) => fixture.fixtureId === fixtureId);

  if (!fixtureMeta) {
    return null;
  }

  let match: BackendMatchDto | null = null;
  try {
    match = await getJson(`/api/Match/${fixtureId}`, matchResponseSchema);
  } catch {
    match = null;
  }

  const baseFixture = createFixtureFromDto(match ?? fixtureMeta);
  const currentProbabilities = {
    teamA: match?.homePct ?? fixtureMeta.homePct ?? 0,
    draw: match?.drawPct ?? fixtureMeta.drawPct ?? 0,
    teamB: match?.awayPct ?? fixtureMeta.awayPct ?? 0,
  };

  let history: BackendMatchHistoryDto | null = null;
  if (match) {
    try {
      history = await getJson(`/api/Match/${fixtureId}/history`, matchHistoryResponseSchema);
    } catch {
      history = null;
    }
  }

  const resolvedFixture = match
    ? {
        ...baseFixture,
        scoreA: match.homeScore,
        scoreB: match.awayScore,
        phase: match.phase,
        minute: formatMinuteLabel(baseFixture.status, match.minute, match.kickOff),
        leadProbability: Math.max(match.homePct, match.awayPct),
      }
    : baseFixture;

  const initialHistory = historyToProbabilityPoints(history, resolvedFixture, currentProbabilities);
  const lastTimestamp =
    initialHistory[initialHistory.length - 1]?.timestamp ?? new Date().toISOString();
  const initialEvents = createInitialEvents(resolvedFixture);

  return {
    fixture: resolvedFixture,
    currentProbabilities,
    history: initialHistory,
    events: initialEvents,
    activeNarrative: undefined,
    connectionState:
      resolvedFixture.status === "live"
        ? ("connecting" satisfies ConnectionState)
        : ("stale" satisfies ConnectionState),
    lastUpdatedAt: lastTimestamp,
  } satisfies LiveMatchState;
}
