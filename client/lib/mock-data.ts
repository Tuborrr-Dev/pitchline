import type {
  Fixture,
  LiveMatchState,
  MatchEvent,
  NarrativeMoment,
  ProbabilityPoint,
} from "./types";

function point(
  minute: string,
  teamA: number,
  draw: number,
  teamB: number,
): ProbabilityPoint {
  const matchMinute = Number.parseInt(minute.replace(/\D/g, ""), 10) || 0;

  return {
    timestamp: new Date(Date.UTC(2026, 6, 3, 19, matchMinute, 0)).toISOString(),
    minuteLabel: minute,
    teamA,
    draw,
    teamB,
  };
}

function event(
  fixtureId: string,
  eventId: string,
  type: MatchEvent["type"],
  minuteLabel: string,
  label: string,
  options: Partial<MatchEvent> = {},
): MatchEvent {
  const matchMinute = Number.parseInt(minuteLabel.replace(/\D/g, ""), 10) || 0;

  return {
    eventId,
    fixtureId,
    type,
    minuteLabel,
    timestamp: new Date(Date.UTC(2026, 6, 3, 19, matchMinute, 0)).toISOString(),
    label,
    importance: "medium",
    ...options,
  };
}

const fixtures: Fixture[] = [
  {
    fixtureId: "arg-fra-live",
    teamAName: "Argentina",
    teamACode: "ARG",
    teamBName: "France",
    teamBCode: "FRA",
    competition: "World Cup 2026",
    stage: "Semi Final",
    kickoffUtc: "2026-07-03T19:00:00.000Z",
    status: "live",
    phase: "H2",
    minute: "78'",
    scoreA: 2,
    scoreB: 1,
    leadProbability: 61.8,
  },
  {
    fixtureId: "bra-esp-live",
    teamAName: "Brazil",
    teamACode: "BRA",
    teamBName: "Spain",
    teamBCode: "ESP",
    competition: "World Cup 2026",
    stage: "Quarter Final",
    kickoffUtc: "2026-07-03T16:00:00.000Z",
    status: "live",
    phase: "H2",
    minute: "66'",
    scoreA: 1,
    scoreB: 1,
    leadProbability: 42.4,
  },
  {
    fixtureId: "demo-all-actions-live",
    teamAName: "Demo United",
    teamACode: "DMU",
    teamBName: "Preview City",
    teamBCode: "PVC",
    competition: "Design Sandbox",
    stage: "All Actions Replay",
    kickoffUtc: "2026-07-03T20:00:00.000Z",
    status: "live",
    phase: "H2",
    minute: "88'",
    scoreA: 2,
    scoreB: 2,
    leadProbability: 29.4,
  },
  {
    fixtureId: "nga-por-upcoming",
    teamAName: "Nigeria",
    teamACode: "NGA",
    teamBName: "Portugal",
    teamBCode: "POR",
    competition: "World Cup 2026",
    stage: "Round of 16",
    kickoffUtc: "2026-07-04T19:00:00.000Z",
    status: "upcoming",
    phase: "NS",
    minute: "KO 19:00",
    scoreA: 0,
    scoreB: 0,
    leadProbability: 38.6,
  },
  {
    fixtureId: "jpn-uru-upcoming",
    teamAName: "Japan",
    teamACode: "JPN",
    teamBName: "Uruguay",
    teamBCode: "URU",
    competition: "World Cup 2026",
    stage: "Round of 16",
    kickoffUtc: "2026-07-04T22:00:00.000Z",
    status: "upcoming",
    phase: "NS",
    minute: "KO 22:00",
    scoreA: 0,
    scoreB: 0,
    leadProbability: 35.2,
  },
];

const histories: Record<string, ProbabilityPoint[]> = {
  "arg-fra-live": [
    point("0", 42.1, 31.7, 26.2),
    point("8", 43.5, 31.0, 25.5),
    point("15", 39.4, 33.7, 26.9),
    point("23", 58.3, 24.4, 17.3),
    point("34", 56.2, 25.3, 18.5),
    point("45", 51.0, 29.1, 19.9),
    point("51", 45.2, 27.8, 27.0),
    point("59", 37.4, 25.9, 36.7),
    point("67", 54.6, 21.3, 24.1),
    point("72", 58.8, 19.7, 21.5),
    point("78", 61.8, 18.0, 20.2),
  ],
  "bra-esp-live": [
    point("0", 37.8, 33.6, 28.6),
    point("9", 39.1, 33.0, 27.9),
    point("18", 46.8, 30.1, 23.1),
    point("33", 42.4, 31.5, 26.1),
    point("45", 40.3, 34.0, 25.7),
    point("52", 36.8, 29.9, 33.3),
    point("66", 42.4, 27.8, 29.8),
  ],
  "demo-all-actions-live": [
    point("0", 35.0, 33.0, 32.0),
    point("6", 38.2, 31.8, 30.0),
    point("11", 44.5, 29.8, 25.7),
    point("17", 41.0, 30.2, 28.8),
    point("24", 34.4, 29.6, 36.0),
    point("31", 29.1, 27.4, 43.5),
    point("39", 33.8, 28.0, 38.2),
    point("45", 35.9, 29.5, 34.6),
    point("52", 47.2, 24.1, 28.7),
    point("58", 54.8, 20.7, 24.5),
    point("64", 46.6, 22.3, 31.1),
    point("71", 39.2, 24.0, 36.8),
    point("77", 43.8, 23.7, 32.5),
    point("83", 34.1, 31.2, 34.7),
    point("88", 29.4, 41.8, 28.8),
  ],
  "nga-por-upcoming": [
    point("0", 38.6, 29.4, 32.0),
    point("1", 38.6, 29.4, 32.0),
  ],
  "jpn-uru-upcoming": [
    point("0", 35.2, 31.3, 33.5),
    point("1", 35.2, 31.3, 33.5),
  ],
};

const narratives: Record<string, NarrativeMoment | undefined> = {
  "arg-fra-live": {
    eventId: "arg-fra-live-goal-67",
    text: "Argentina swung the market back with a ruthless transition finish after France had finally stabilized. Argentina now trade at 61.8%.",
    createdAt: "2026-07-03T20:08:00.000Z",
    reason: "late lead change",
  },
  "bra-esp-live": {
    eventId: "bra-esp-live-var-66",
    text: "The market tightened after VAR upheld the equalizer and killed Brazil's earlier drift upward. Brazil now trade at 42.4%.",
    createdAt: "2026-07-03T17:07:00.000Z",
    reason: "swing above 15 points",
  },
  "demo-all-actions-live": {
    eventId: "demo-all-actions-live-goal-83",
    text: "The replay swings through cards, VAR, penalties, and a late equalizer so every chart marker state can be reviewed on one fixture.",
    createdAt: "2026-07-03T21:23:00.000Z",
    reason: "design preview fixture",
  },
};

const events: Record<string, MatchEvent[]> = {
  "arg-fra-live": [
    event("arg-fra-live", "arg-fra-live-goal-23", "goal", "23'", "ARG score", {
      side: "teamA",
      delta: 18.9,
      importance: "high",
      detailLabel: "Alvarez scores. Argentina surge as the market reprices the match.",
    }),
    event("arg-fra-live", "arg-fra-live-half-45", "half-time", "45'", "Half time", {
      importance: "structural",
      side: "draw",
    }),
    event("arg-fra-live", "arg-fra-live-goal-51", "goal", "51'", "FRA equalize", {
      side: "teamB",
      delta: 7.1,
      importance: "high",
    }),
    event("arg-fra-live", "arg-fra-live-red-59", "red-card", "59'", "ARG red card", {
      side: "teamA",
      delta: -7.8,
      importance: "high",
    }),
    event("arg-fra-live", "arg-fra-live-goal-67", "goal", "67'", "ARG retake lead", {
      side: "teamA",
      delta: 17.2,
      importance: "high",
    }),
    event("arg-fra-live", "arg-fra-live-var-72", "var", "72'", "VAR check", {
      side: "draw",
      importance: "medium",
    }),
  ],
  "bra-esp-live": [
    event("bra-esp-live", "bra-esp-live-goal-18", "goal", "18'", "BRA score", {
      side: "teamA",
      delta: 9.0,
      importance: "high",
    }),
    event("bra-esp-live", "bra-esp-live-half-45", "half-time", "45'", "Half time", {
      importance: "structural",
      side: "draw",
    }),
    event("bra-esp-live", "bra-esp-live-goal-52", "goal", "52'", "ESP equalize", {
      side: "teamB",
      delta: 8.2,
      importance: "high",
    }),
    event("bra-esp-live", "bra-esp-live-var-66", "var", "66'", "VAR confirms goal", {
      side: "draw",
      delta: 5.6,
      importance: "medium",
    }),
  ],
  "demo-all-actions-live": [
    event("demo-all-actions-live", "demo-all-actions-live-status-6", "status", "6'", "Pressing wave", {
      side: "draw",
      delta: 3.2,
      detailLabel: "Demo United open aggressively and force the first market repricing.",
      importance: "low",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-goal-11", "goal", "11'", "DMU opener", {
      side: "teamA",
      delta: 9.4,
      importance: "high",
      detailLabel: "Demo United finish a transition move. Team A spikes into the lead.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-yellow-17", "yellow-card", "17'", "PVC booked", {
      side: "teamB",
      delta: -2.1,
      importance: "medium",
      detailLabel: "Preview City take a yellow while trying to stop the break.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-goal-24", "goal", "24'", "PVC equalizer", {
      side: "teamB",
      delta: 10.3,
      importance: "high",
      detailLabel: "Preview City level the match and the market flips back toward neutral.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-red-31", "red-card", "31'", "DMU red card", {
      side: "teamA",
      delta: -7.6,
      importance: "high",
      detailLabel: "Demo United go down to ten men and surrender control of the book.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-pen-awarded-39", "penalty-awarded", "39'", "PVC penalty won", {
      side: "teamB",
      delta: 4.3,
      importance: "high",
      detailLabel: "Preview City win a penalty after the red card pressure starts to compound.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-pen-scored-45", "penalty-scored", "45'", "PVC convert penalty", {
      side: "teamB",
      delta: 3.9,
      importance: "high",
      detailLabel: "Preview City convert from the spot right before the break.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-half-45", "half-time", "45'", "Half time", {
      side: "draw",
      importance: "structural",
      detailLabel: "The replay pauses at the break with Preview City ahead.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-var-52", "var", "52'", "VAR reversal", {
      side: "draw",
      delta: 8.2,
      importance: "high",
      detailLabel: "VAR cancels the penalty sequence and resets the market sharply toward Demo United.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-goal-58", "goal", "58'", "DMU reclaim lead", {
      side: "teamA",
      delta: 7.6,
      importance: "high",
      detailLabel: "Demo United capitalize immediately after the reversal and retake the lead.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-pen-missed-64", "penalty-missed", "64'", "PVC miss from the spot", {
      side: "teamB",
      delta: -5.4,
      importance: "high",
      detailLabel: "Preview City miss a second penalty and their win equity fades again.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-yellow-71", "yellow-card", "71'", "DMU booked", {
      side: "teamA",
      delta: -1.7,
      importance: "medium",
      detailLabel: "Demo United take a caution while protecting a fragile lead.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-status-77", "status", "77'", "Momentum swing", {
      side: "draw",
      delta: 2.4,
      importance: "low",
      detailLabel: "Preview City pin Demo United back and compress the market spread.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-goal-83", "goal", "83'", "PVC late equalizer", {
      side: "teamB",
      delta: 6.1,
      importance: "high",
      detailLabel: "Preview City find the equalizer late and push the match back into a balanced state.",
    }),
    event("demo-all-actions-live", "demo-all-actions-live-full-88", "full-time", "88'", "Replay cutoff", {
      side: "draw",
      importance: "structural",
      detailLabel: "Preview fixture ends here so the chart shows the full action stack in one pass.",
    }),
  ],
  "nga-por-upcoming": [],
  "jpn-uru-upcoming": [],
};

export function getLobbyFixtures() {
  const live = fixtures.filter((fixture) => fixture.status === "live");
  const upcoming = fixtures.filter((fixture) => fixture.status === "upcoming");

  return { live, upcoming };
}

export function getMarketOverviewRows() {
  return [
    {
      fixture: fixtures[0],
      status: "live",
      statusLabel: "LIVE",
      eventPair: "ARG VS FRA",
      eventSubLabel: "FIFA WORLD CUP · FINALS",
      scoreLine: "2 - 1",
      timeLabel: "68:24",
      probabilities: { home: 64.5, draw: 22.1, away: 13.4 },
      liquidity: "$12.4M",
      depth: "+4.2%",
      action: "TRADE",
      actionTone: "primary",
    },
    {
      fixture: {
        ...fixtures[1],
        fixtureId: "bra-cro-pre",
        teamBName: "Croatia",
        teamBCode: "CRO",
        stage: "Quarter Finals",
      },
      status: "pre",
      statusLabel: "PRE",
      eventPair: "BRA VS CRO",
      eventSubLabel: "FIFA WORLD CUP · QUARTER FINALS",
      scoreLine: "0 - 0",
      timeLabel: "T-04:08:08",
      probabilities: { home: 58.0, draw: 25.0, away: 17.0 },
      liquidity: "$8.1M",
      depth: "+1.3%",
      action: "PLACE",
      actionTone: "secondary",
    },
    {
      fixture: {
        ...fixtures[2],
        fixtureId: "eng-sen-live",
        teamAName: "England",
        teamACode: "ENG",
        teamBName: "Senegal",
        teamBCode: "SEN",
        status: "live",
        stage: "Round of 16",
      },
      status: "live",
      statusLabel: "LIVE",
      eventPair: "ENG VS SEN",
      eventSubLabel: "FIFA WORLD CUP · ROUND OF 16",
      scoreLine: "0 - 0",
      timeLabel: "12:15",
      probabilities: { home: 45.2, draw: 35.1, away: 19.7 },
      liquidity: "$2.9M",
      depth: "+8.9%",
      action: "TRADE",
      actionTone: "primary",
    },
  ];
}

export function getFixtureById(fixtureId: string) {
  return fixtures.find((fixture) => fixture.fixtureId === fixtureId);
}

export function getHistoryByFixtureId(fixtureId: string) {
  return histories[fixtureId] ?? [];
}

export function getLiveMatchState(fixtureId: string): LiveMatchState | undefined {
  const fixture = getFixtureById(fixtureId);
  if (!fixture) return undefined;

  const history = getHistoryByFixtureId(fixtureId);
  const latestPoint = history[history.length - 1];

  return {
    fixture,
    currentProbabilities: {
      teamA: latestPoint?.teamA ?? 0,
      draw: latestPoint?.draw ?? 0,
      teamB: latestPoint?.teamB ?? 0,
    },
    history,
    events: events[fixtureId] ?? [],
    annotations: [],
    activeNarrative: narratives[fixtureId],
    connectionState: fixture.status === "live" ? "live" : "connecting",
    lastUpdatedAt: history[history.length - 1]?.timestamp ?? fixture.kickoffUtc,
  };
}
