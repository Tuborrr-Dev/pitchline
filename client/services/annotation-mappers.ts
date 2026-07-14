import type { Annotation, Fixture, MatchEvent, MatchEventType } from "@/lib/types";

export function annotationEventId(annotation: Pick<Annotation, "fixture_id" | "source_action" | "source_id">) {
  return `${annotation.fixture_id}-${annotation.source_action}-${annotation.source_id}`;
}

function normalizeAction(action: string) {
  return action.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();
}

function toTitle(value: string) {
  return normalizeAction(value)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function annotationEventType(annotation: Annotation): MatchEventType {
  const action = normalizeAction(annotation.action || annotation.source_action);
  const outcome = normalizeAction(annotation.outcome ?? "");

  if (action.includes("goal")) return "goal";
  if (action.includes("yellow") && action.includes("card")) return "yellow-card";
  if (action.includes("red") && action.includes("card")) return "red-card";
  if (action.includes("penalty")) {
    if (outcome.includes("miss")) return "penalty-missed";
    if (outcome.includes("scor")) return "penalty-scored";
    return "penalty-awarded";
  }
  if (action.includes("var")) return "var";
  if (action.includes("half")) return "half-time";
  if (action.includes("full") || action.includes("game_finalised")) return "full-time";

  return "status";
}

function annotationImportance(type: MatchEventType) {
  if (type === "goal" || type === "red-card" || type.startsWith("penalty")) return "high";
  if (type === "yellow-card" || type === "var") return "medium";
  if (type === "half-time" || type === "full-time") return "structural";
  return "low";
}

function annotationSide(annotation: Annotation, fixture: Fixture): MatchEvent["side"] {
  const team = annotation.team?.trim().toLowerCase();
  if (!team) return "draw";

  if (team === fixture.teamBName.toLowerCase() || team === fixture.teamBCode.toLowerCase()) {
    return "teamB";
  }

  if (team === fixture.teamAName.toLowerCase() || team === fixture.teamACode.toLowerCase()) {
    return "teamA";
  }

  if (annotation.color === "red") return "teamB";
  if (annotation.color === "green") return "teamA";

  return "draw";
}

function annotationTimestamp(annotation: Annotation, fixture: Fixture) {
  const kickoff = new Date(fixture.kickoffUtc).getTime();
  if (!Number.isNaN(kickoff)) {
    if (typeof annotation.source_seconds === "number") {
      return new Date(kickoff + annotation.source_seconds * 1000).toISOString();
    }

    if (typeof annotation.minute === "number") {
      return new Date(kickoff + annotation.minute * 60_000).toISOString();
    }
  }

  return new Date().toISOString();
}

export function annotationToMatchEvent(annotation: Annotation, fixture: Fixture): MatchEvent {
  const type = annotationEventType(annotation);
  const side = annotationSide(annotation, fixture);
  const teamCode =
    side === "teamA" ? fixture.teamACode : side === "teamB" ? fixture.teamBCode : undefined;

  return {
    eventId: annotationEventId(annotation),
    fixtureId: String(annotation.fixture_id),
    type,
    minuteLabel: typeof annotation.minute === "number" ? `${annotation.minute}'` : "0'",
    timestamp: annotationTimestamp(annotation, fixture),
    side,
    teamCode,
    label: toTitle(annotation.action || annotation.source_action) || "Update",
    detailLabel: annotation.text ?? annotation.reason ?? annotation.outcome ?? undefined,
    importance: annotationImportance(type),
  };
}

export function annotationsToMatchEvents(annotations: Annotation[], fixture: Fixture) {
  const byId = new Map<string, MatchEvent>();

  annotations.forEach((annotation) => {
    byId.set(annotationEventId(annotation), annotationToMatchEvent(annotation, fixture));
  });

  return [...byId.values()].sort((left, right) => {
    const minuteDelta = Number.parseInt(left.minuteLabel, 10) - Number.parseInt(right.minuteLabel, 10);
    if (minuteDelta !== 0) return minuteDelta;
    return left.eventId.localeCompare(right.eventId);
  });
}
