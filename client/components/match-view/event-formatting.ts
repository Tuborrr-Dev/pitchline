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

export function eventCommentary(event: MatchEvent) {
  return event.detailLabel ?? eventDeltaLabel(event);
}

export function isPreKickoffFixture(fixture: LiveMatchState["fixture"]) {
  const kickoffTime = new Date(fixture.kickoffUtc).getTime();
  const metadata = `${fixture.status} ${fixture.phase} ${fixture.minute} ${fixture.competition} ${fixture.stage}`.toLowerCase();
  const kickoffIsFuture = !Number.isNaN(kickoffTime) && kickoffTime > Date.now();

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
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }).format(new Date(kickoffUtc));
}
