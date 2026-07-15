import type {
  ConnectionState,
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
} from "@/schemas/pitchline";

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

  if (
    value.includes("scheduled") ||
    value.includes("not started") ||
    value.includes("pre") ||
    (!Number.isNaN(kickoffTime) && kickoffTime > Date.now())
  ) {
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

function buildFixtureMeta(status: MatchStatus, kickoffUtc: string, phase: string | null | undefined) {
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
  const dedupedByTimestamp = new Map<string, ProbabilityPoint>();

  history.forEach((point) => {
    if (!isUsableHistoryTimestamp(point.timestamp)) return;
    dedupedByTimestamp.set(point.timestamp, point);
  });

  return [...dedupedByTimestamp.values()].sort(
    (left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}

export function historyToProbabilityPoints(
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

  return normalizeProbabilityHistory(
    oddsHistory.map((point) => {
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
    }),
  );
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

export function createInitialEvents(fixture: Fixture) {
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

export function toInitialConnectionState(status: MatchStatus) {
  return status === "live"
    ? ("connecting" satisfies ConnectionState)
    : ("stale" satisfies ConnectionState);
}
