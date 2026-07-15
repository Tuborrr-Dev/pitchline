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
        minuteLabel: `${elapsedMinutes}'`,
        teamA: point.homePct,
        draw: point.drawPct,
        teamB: point.awayPct,
      } satisfies ProbabilityPoint;
    }),
  );
}

function normalizeEventType(eventType: string): MatchEvent["type"] {
  const value = eventType.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();

  if (value.includes("goal")) return "goal";
  if (value.includes("yellow") && value.includes("card")) return "yellow-card";
  if (value.includes("red") && value.includes("card")) return "red-card";
  if (value.includes("penalty")) {
    if (value.includes("miss")) return "penalty-missed";
    if (value.includes("scor")) return "penalty-scored";
    return "penalty-awarded";
  }
  if (value.includes("var")) return "var";
  if (value.includes("half")) return "half-time";
  if (value.includes("full") || value.includes("final")) return "full-time";

  return "status";
}

function eventImportance(type: MatchEvent["type"]): MatchEvent["importance"] {
  if (type === "goal" || type === "red-card" || type.startsWith("penalty")) return "high";
  if (type === "yellow-card" || type === "var") return "medium";
  if (type === "half-time" || type === "full-time") return "structural";
  return "low";
}

function scoreEventSide(
  event: NonNullable<BackendMatchHistoryDto["events"]>[number],
  previousEvent: NonNullable<BackendMatchHistoryDto["events"]>[number] | undefined,
): MatchEvent["side"] {
  const previousHomeScore = previousEvent?.homeScore ?? 0;
  const previousAwayScore = previousEvent?.awayScore ?? 0;
  const homeDelta = event.homeScore - previousHomeScore;
  const awayDelta = event.awayScore - previousAwayScore;

  if (homeDelta > awayDelta) return "teamA";
  if (awayDelta > homeDelta) return "teamB";
  return "draw";
}

function eventTitle(eventType: string) {
  return eventType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function historyToMatchEvents(history: BackendMatchHistoryDto | null, fixture: Fixture) {
  const events = history?.events ?? [];

  return events.map((event, index) => {
    const type = normalizeEventType(event.eventType);
    const side = scoreEventSide(event, events[index - 1]);
    const teamCode =
      side === "teamA" ? fixture.teamACode : side === "teamB" ? fixture.teamBCode : undefined;
    const minuteLabel = formatMinuteLabel(
      fixture.status,
      event.minute ?? undefined,
      fixture.kickoffUtc,
    );

    return {
      eventId: `${fixture.fixtureId}-be1-${event.eventType}-${event.timestamp}-${index}`,
      fixtureId: fixture.fixtureId,
      type,
      minuteLabel,
      timestamp: event.timestamp,
      side,
      teamCode,
      label: type === "goal" ? `${teamCode ?? "MKT"} goal` : eventTitle(event.eventType),
      detailLabel: `${event.phase ?? fixture.phase} / ${event.homeScore} - ${event.awayScore}`,
      importance: eventImportance(type),
    } satisfies MatchEvent;
  });
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
