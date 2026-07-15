import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Fixture, LiveMatchState, MatchEvent, ProbabilityPoint } from "./types";
import { deriveTeamCode } from "@/services/pitchline-mappers";

type ReplayOddsPoint = {
  homePct: number;
  drawPct: number;
  awayPct: number;
  timestamp: string;
};

type ReplayEvent = {
  eventType: string;
  homeScore: number;
  awayScore: number;
  minute: string;
  phase: string;
  timestamp: string;
};

type ReplayMatchData = {
  fixtureId: string;
  homeName: string;
  awayName: string;
  oddsHistory: readonly ReplayOddsPoint[];
  events: readonly ReplayEvent[];
};

type ReplayMatchEvent = MatchEvent & {
  replayHomeScore: number;
  replayAwayScore: number;
  replayPhase: string;
};

const LIVE_REPLAY_FIXTURE_ID = "fake-live-match-001";
const MATCH_DATA_PATH = path.resolve(process.cwd(), "..", "test", "match-data.txt");

async function readReplayMatchData() {
  const file = await readFile(MATCH_DATA_PATH, "utf8");
  const data = JSON.parse(file) as ReplayMatchData;

  return {
    ...data,
    fixtureId: LIVE_REPLAY_FIXTURE_ID,
  } satisfies ReplayMatchData;
}

function minutesFromStart(timestamp: string, startTimestamp: string) {
  const timestampMs = new Date(timestamp).getTime();
  const startMs = new Date(startTimestamp).getTime();

  if (Number.isNaN(timestampMs) || Number.isNaN(startMs)) {
    return 0;
  }

  return Math.max(0, Math.round((timestampMs - startMs) / 60_000));
}

function mapEventType(eventType: string): MatchEvent["type"] {
  switch (eventType) {
    case "goal":
      return "goal";
    case "yellow_card":
    case "yellowCard":
      return "yellow-card";
    case "red_card":
    case "redCard":
      return "red-card";
    case "penalty_awarded":
    case "penaltyAwarded":
      return "penalty-awarded";
    case "penalty_scored":
    case "penaltyScored":
      return "penalty-scored";
    case "penalty_missed":
    case "penaltyMissed":
      return "penalty-missed";
    case "var":
    case "VAR":
      return "var";
    case "half_time":
    case "halfTime":
      return "half-time";
    case "full_time":
    case "fullTime":
      return "full-time";
    default:
      return "status";
  }
}

function mapReplayEvents(data: ReplayMatchData) {
  let previousHomeScore = 0;
  let previousAwayScore = 0;

  return data.events.map((event, index) => {
    const homeDelta = event.homeScore - previousHomeScore;
    const awayDelta = event.awayScore - previousAwayScore;
    const side =
      homeDelta > awayDelta
        ? "teamA"
        : awayDelta > homeDelta
          ? "teamB"
          : "draw";

    previousHomeScore = event.homeScore;
    previousAwayScore = event.awayScore;

    const teamCode =
      side === "teamA"
        ? deriveTeamCode(data.homeName)
        : side === "teamB"
          ? deriveTeamCode(data.awayName)
          : undefined;

    return {
      eventId: `${data.fixtureId}-${event.eventType}-${event.minute}-${index}`,
      fixtureId: data.fixtureId,
      type: mapEventType(event.eventType),
      minuteLabel: event.minute.includes("'") ? event.minute : `${event.minute}'`,
      timestamp: new Date(event.timestamp).toISOString(),
      side,
      teamCode,
      label:
        event.eventType === "goal"
          ? `${teamCode ?? "MKT"} goal`
          : event.eventType.replace(/-/g, " "),
      detailLabel: `${event.phase} / ${event.homeScore} - ${event.awayScore}`,
      importance: event.eventType === "goal" ? "high" : "low",
      replayHomeScore: event.homeScore,
      replayAwayScore: event.awayScore,
      replayPhase: event.phase,
    } satisfies ReplayMatchEvent;
  });
}

export function getLiveReplayFixtureId() {
  return LIVE_REPLAY_FIXTURE_ID;
}

export async function getLiveReplayMatchState(fixtureId: string): Promise<LiveMatchState | undefined> {
  if (fixtureId !== LIVE_REPLAY_FIXTURE_ID) {
    return undefined;
  }

  const matchData = await readReplayMatchData();
  if (matchData.oddsHistory.length === 0) {
    return undefined;
  }

  const firstPoint = matchData.oddsHistory[0];
  const lastPoint = matchData.oddsHistory[matchData.oddsHistory.length - 1];
  const events = mapReplayEvents(matchData);
  const latestEvent = events[events.length - 1];
  const latestReplayEvent = matchData.events[matchData.events.length - 1];
  const kickoffUtc = new Date(firstPoint.timestamp).toISOString();
  const history = matchData.oddsHistory.map((point) => {
    const minute = minutesFromStart(point.timestamp, firstPoint.timestamp);

    return {
      timestamp: new Date(point.timestamp).toISOString(),
      minuteLabel: `${minute}'`,
      teamA: point.homePct,
      draw: point.drawPct,
      teamB: point.awayPct,
    } satisfies ProbabilityPoint;
  });

  const fixture = {
    fixtureId: matchData.fixtureId,
    teamAName: matchData.homeName,
    teamACode: deriveTeamCode(matchData.homeName),
    teamBName: matchData.awayName,
    teamBCode: deriveTeamCode(matchData.awayName),
    competition: "Replay Test",
    stage: "match-data.txt",
    kickoffUtc,
    status: "live",
    phase: latestReplayEvent?.phase ?? "1st Half",
    minute: latestEvent?.minuteLabel ?? "0'",
    scoreA: latestReplayEvent?.homeScore ?? 0,
    scoreB: latestReplayEvent?.awayScore ?? 0,
    leadProbability: Math.max(lastPoint.homePct, lastPoint.awayPct),
  } satisfies Fixture;

  return {
    fixture,
    currentProbabilities: {
      teamA: firstPoint.homePct,
      draw: firstPoint.drawPct,
      teamB: firstPoint.awayPct,
    },
    history,
    events,
    annotations: [],
    connectionState: "connecting",
    lastUpdatedAt: kickoffUtc,
  };
}
