export type ConnectionState =
  | "connecting"
  | "live"
  | "reconnecting"
  | "stale"
  | "offline";

export type MatchStatus = "live" | "upcoming" | "finished";

export type MatchEventType =
  | "goal"
  | "yellow-card"
  | "red-card"
  | "penalty-awarded"
  | "penalty-scored"
  | "penalty-missed"
  | "var"
  | "status"
  | "half-time"
  | "full-time";

export type EventImportance = "high" | "medium" | "low" | "structural";

export interface Fixture {
  fixtureId: string;
  teamAName: string;
  teamACode: string;
  teamBName: string;
  teamBCode: string;
  competition: string;
  stage: string;
  kickoffUtc: string;
  status: MatchStatus;
  phase: string;
  minute: string;
  scoreA: number;
  scoreB: number;
  leadProbability: number;
}

export interface ProbabilityPoint {
  timestamp: string;
  minuteLabel: string;
  teamA: number;
  draw: number;
  teamB: number;
}

export interface MatchEvent {
  eventId: string;
  fixtureId: string;
  type: MatchEventType;
  minuteLabel: string;
  timestamp: string;
  side?: "teamA" | "teamB" | "draw";
  teamCode?: string;
  label: string;
  detailLabel?: string;
  delta?: number;
  importance: EventImportance;
  annotationColor?: string;
  annotationIcon?: string;
  annotationAction?: string;
  annotationType?: Annotation["type"];
}

export interface NarrativeMoment {
  eventId: string;
  text: string;
  createdAt: string;
  reason: string;
}

export interface MarketAnalyticsData {
  momentum?: { slope: number; direction: string };
  volatility?: { stdDev: number; level: string };
  marketFreeze?: { isFrozen: boolean; secondsSinceUpdate: number };
  peakSwing?: { delta: number; minute: string };
}

export interface Annotation {
  id?: number;
  fixture_id: number;
  source_action: string;
  source_id: number;
  source_seconds?: number;
  type: "commentary" | "annotation" | "update";
  action: string;
  team?: string | null;
  player?: string | null;
  minute?: number | null;
  phase?: string;
  home_score?: number | null;
  away_score?: number | null;
  icon?: string;
  color?: string;
  text?: string;
  outcome?: string | null;
  score?: number;
  reason?: string;
}

export interface LiveMatchState {
  fixture: Fixture;
  currentProbabilities: {
    teamA: number;
    draw: number;
    teamB: number;
  };
  history: ProbabilityPoint[];
  events: MatchEvent[];
  annotations: Annotation[];
  activeNarrative?: NarrativeMoment;
  selectedTimestamp?: string;
  connectionState: ConnectionState;
  lastUpdatedAt: string;
  analytics?: MarketAnalyticsData;
}
