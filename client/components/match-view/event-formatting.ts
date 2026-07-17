import type { LiveMatchState, MatchEvent } from "@/lib/types";

export function eventTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return event.side === "teamB"
        ? "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]"
        : "border-l-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)]";
    case "red-card":
      return "border-l-[#ff4b6e] bg-red-500/10 text-[#d71945]";
    case "yellow-card":
      return "border-l-[var(--signal)] bg-yellow-500/10 text-[#a37200]";
    case "var":
      return "border-l-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)]";
    default:
      return "border-l-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)]";
  }
}

export function eventDeltaLabel(event: MatchEvent) {
  if (!event.delta) return "Volatility low";
  const side = event.teamCode ?? (event.side === "draw" ? "MKT" : "LIVE");
  return `${event.delta > 0 ? "+" : ""}${event.delta.toFixed(1)}% ${side} equity`;
}

export function isMatchBreakFixture(fixture: LiveMatchState["fixture"]) {
  const metadata = `${fixture.status} ${fixture.phase} ${fixture.minute}`.toLowerCase();

  return (
    metadata.includes("half-time") ||
    metadata.includes("halftime") ||
    metadata.includes("interval") ||
    metadata.includes("break") ||
    metadata.split(/\s+/).includes("ht")
  );
}

export function isPreKickoffFixture(fixture: LiveMatchState["fixture"]) {
  const kickoffTime = new Date(fixture.kickoffUtc).getTime();
  const metadata = `${fixture.status} ${fixture.phase} ${fixture.minute} ${fixture.competition} ${fixture.stage}`.toLowerCase();
  const kickoffIsFuture = fixture.status === "upcoming" && !Number.isNaN(kickoffTime) && kickoffTime > Date.now();

  if (isMatchBreakFixture(fixture)) {
    return false;
  }

  if (fixture.status === "live" || fixture.status === "finished") {
    return false;
  }

  return (
    fixture.status === "upcoming" ||
    metadata.includes("scheduled") ||
    metadata.includes("not started") ||
    kickoffIsFuture
  );
}

export function formatKickoffDate(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(kickoffUtc));
}
