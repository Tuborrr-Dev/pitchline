import type {
  Fixture,
  LiveMatchState,
  MatchEvent,
  MatchStatus,
  ProbabilityPoint,
} from "@/lib/types";
import type {
  BackendFixtureDto,
  BackendMatchDto,
  BackendMatchHistoryDto,
  ClockAnchor,
} from "@/schemas/pitchline";
import { toMatchMinute } from "@/lib/clock-anchors";

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

export function deriveTeamCode(name: string) {
  if (!name || name.trim() === "") return "CLB";
  const cleanName = name.trim();
  const override = teamCodeOverrides[cleanName];
  if (override) return override;

  const words = cleanName
    .split(/[\s-]+/)
    .map((part) => part.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "CLB";

  // Filter out generic club suffixes/prefixes when generating 3-letter code if possible
  const meaningfulWords = words.filter(
    (w) => !["FC", "CF", "SC", "AC", "FK", "BK", "SV", "AFC"].includes(w.toUpperCase()),
  );
  const targetWords = meaningfulWords.length > 0 ? meaningfulWords : words;

  if (targetWords.length >= 3) {
    return `${targetWords[0][0]}${targetWords[1][0]}${targetWords[2][0]}`.toUpperCase();
  }

  if (targetWords.length === 2) {
    const first = targetWords[0];
    const second = targetWords[1];
    if (first.length >= 2) {
      return `${first[0]}${first[1]}${second[0]}`.toUpperCase();
    }
    return `${first[0]}${second[0]}${second[1] ?? ""}`.toUpperCase();
  }

  const singleWord = targetWords[0];
  return singleWord.slice(0, 3).toUpperCase() || "CLB";
}

function parseMinuteNumber(minute: string) {
  return Number.parseInt(minute.replace(/\D/g, ""), 10) || 0;
}

function formatUtcKickoff(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(kickoffUtc));
}

function toMatchStatus(phase: string | null | undefined, kickoffUtc?: string) {
  const value = (phase ?? "").toLowerCase();
  const kickoffTime = kickoffUtc ? new Date(kickoffUtc).getTime() : Number.NaN;
  const isExplicitlyUpcoming =
    value.includes("scheduled") ||
    value.includes("not started") ||
    value.includes("pre");

  if (isExplicitlyUpcoming || (!value && !Number.isNaN(kickoffTime) && kickoffTime > Date.now())) {
    return "upcoming" satisfies MatchStatus;
  }

  if (
    value.includes("finished") ||
    value.includes("abandoned") ||
    value.includes("cancelled")
  ) {
    return "finished" satisfies MatchStatus;
  }

  return "live" satisfies MatchStatus;
}

export function formatMinuteLabel(
  status: MatchStatus,
  minute: string | null | undefined,
  kickoffUtc: string,
) {
  if (status === "upcoming") {
    return `KO ${formatUtcKickoff(kickoffUtc)}`;
  }

  const cleanMinute = (minute ?? "").trim();
  if (!cleanMinute) {
    return status === "finished" ? "FT" : "0'";
  }

  return cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`;
}

function formatHistoryMinuteLabel(minute: string | null | undefined, fallbackMinute: number) {
  const cleanMinute = (minute ?? "").trim();
  if (!cleanMinute) return `${Math.max(0, Math.round(fallbackMinute))}'`;
  return cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`;
}

function resolveHistoryMinuteLabel(
  timestamp: string,
  minute: string | null | undefined,
  fallbackMinute: number,
  clockAnchors: readonly ClockAnchor[],
) {
  const anchoredMinute = clockAnchors.length > 0 ? toMatchMinute(timestamp, clockAnchors) : null;

  if (anchoredMinute !== null) {
    return formatHistoryMinuteLabel(null, anchoredMinute);
  }

  return formatHistoryMinuteLabel(minute, fallbackMinute);
}

function buildFixtureMeta(status: MatchStatus, kickoffUtc: string) {
  if (status === "upcoming") {
    return {
      competition: `Kickoff ${formatUtcKickoff(kickoffUtc)}`,
      stage: "",
    };
  }

  if (status === "finished") {
    return {
      competition: "Settled Market",
      stage: "",
    };
  }

  return {
    competition: "Live Market",
    stage: `Kickoff ${formatUtcKickoff(kickoffUtc)}`,
  };
}

export function createFixtureFromDto(dto: BackendFixtureDto | BackendMatchDto) {
  const status = toMatchStatus(dto.phase, dto.kickOff);
  const teamACode = deriveTeamCode(dto.homeName);
  const teamBCode = deriveTeamCode(dto.awayName);
  const meta = buildFixtureMeta(status, dto.kickOff);

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

export function buildScoreLine(fixture: Fixture) {
  return `${fixture.scoreA} - ${fixture.scoreB}`;
}

export function buildTimeLabel(fixture: Fixture) {
  if (fixture.status === "upcoming") {
    return fixture.minute;
  }

  if (fixture.status === "finished") {
    return "FT";
  }

  return `${fixture.phase} / ${fixture.minute}`;
}

export function buildMarketPlaceholder(fixture: Fixture) {
  if (fixture.status === "live") {
    return { liquidity: fixture.phase, depth: fixture.minute, action: "TRACK" };
  }

  if (fixture.status === "finished") {
    return { liquidity: "-", depth: "Settled", action: "RECAP" };
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

function normalizeProbabilityHistory(history: ProbabilityPoint[]) {
  const seenTimestamps = new Map<string, number>();
  let previousTime = 0;

  return history.map((point, index) => {
    const timestampCount = seenTimestamps.get(point.timestamp) ?? 0;
    seenTimestamps.set(point.timestamp, timestampCount + 1);
    const parsedTime = new Date(point.timestamp).getTime();

    if (
      timestampCount === 0 &&
      isUsableHistoryTimestamp(point.timestamp) &&
      parsedTime > previousTime
    ) {
      previousTime = parsedTime;
      return point;
    }

    const nextTime = previousTime > 0 ? previousTime + 1000 : Date.now() + index * 1000;
    previousTime = nextTime;

    return {
      ...point,
      timestamp: new Date(nextTime).toISOString(),
    };
  });
}

export function historyToProbabilityPoints(
  history: BackendMatchHistoryDto | null,
  fixture: Fixture,
  fallbackProbabilities: LiveMatchState["currentProbabilities"],
  clockAnchors: readonly ClockAnchor[] = [],
) {
  const oddsHistory = history?.oddsHistory ?? [];

  if (oddsHistory.length === 0) {
    return seedHistoryFromCurrentState(
      fixture,
      fallbackProbabilities,
      new Date().toISOString(),
    );
  }

  return normalizeProbabilityHistory(
    oddsHistory.map((point, index) => {
      const hasUsableTimestamp = isUsableHistoryTimestamp(point.timestamp);
      const elapsedMinutes = hasUsableTimestamp
        ? Math.max(
            0,
            Math.round(
              (new Date(point.timestamp).getTime() - new Date(fixture.kickoffUtc).getTime()) / 60_000,
            ),
          )
        : index;

      return {
        timestamp: point.timestamp,
        minuteLabel: resolveHistoryMinuteLabel(
          point.timestamp,
          point.minute,
          elapsedMinutes,
          clockAnchors,
        ),
        teamA: point.homePct,
        draw: point.drawPct,
        teamB: point.awayPct,
      } satisfies ProbabilityPoint;
    }),
  );
}

export function mergeMatchEvents(...eventGroups: MatchEvent[][]) {
  const byId = new Map<string, MatchEvent>();

  eventGroups.flat().forEach((event) => {
    byId.set(event.eventId, event);
  });

  return [...byId.values()].sort((left, right) => {
    const timeDelta = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();
    if (!Number.isNaN(timeDelta) && timeDelta !== 0) return timeDelta;
    return left.eventId.localeCompare(right.eventId);
  });
}
