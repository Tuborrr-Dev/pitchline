"use client";

import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";

import { LatencyReadout } from "@/components/latency-readout";
import { getTeamFlagUrl } from "@/components/team-logo";
import type { LiveMatchState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatKickoffDate, isMatchBreakFixture, isPreKickoffFixture } from "./event-formatting";

export function MatchScoreHeader({
  currentProbabilities,
  fixture,
  lastUpdatedAt,
}: {
  currentProbabilities: LiveMatchState["currentProbabilities"];
  fixture: LiveMatchState["fixture"];
  lastUpdatedAt: string;
}) {
  const preKickoff = isPreKickoffFixture(fixture);
  const { resolvedTheme } = useTheme();
  const isDarkTheme = resolvedTheme === "dark";
  const matchBreak = isMatchBreakFixture(fixture);
  const isFinished = fixture.status === "finished" || fixture.phase === "Finished" || fixture.phase === "FT";
  const hasOdds = currentProbabilities.teamA > 0 || currentProbabilities.teamB > 0;
  const liveTimerText = useMatchTimer({
    enabled: fixture.status === "live" && !preKickoff && !isFinished,
    lastUpdatedAt,
    minute: fixture.minute,
    phase: fixture.phase,
  });
  const homeFlagUrl = getTeamFlagUrl(fixture.teamACode, fixture.teamAName);
  const awayFlagUrl = getTeamFlagUrl(fixture.teamBCode, fixture.teamBName);

  // Determine center badge text
  let centerBadgeText = "";
  if (isFinished) {
    centerBadgeText = "FULL TIME";
  } else if (matchBreak) {
    centerBadgeText = structuralTimerLabel(fixture.phase, fixture.minute) ?? "BREAK";
  } else if (preKickoff) {
    centerBadgeText = `KO ${formatKickoffDate(fixture.kickoffUtc)}`;
  } else if (!hasOdds) {
    centerBadgeText = "MARKET PENDING";
  } else {
    centerBadgeText = liveTimerText;
  }

  // Determine team subtitles
  let homeSubtitle: string | null = `Win ${currentProbabilities.teamA.toFixed(1)}%`;
  let awaySubtitle: string | null = `Win ${currentProbabilities.teamB.toFixed(1)}%`;
  let homeColor = currentProbabilities.teamA > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]";
  let awayColor = currentProbabilities.teamB > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]";

  if (isFinished) {
    homeSubtitle = null;
    awaySubtitle = null;
  } else if (!hasOdds && !preKickoff) {
    homeSubtitle = "Odds Pending";
    awaySubtitle = "Odds Pending";
    homeColor = "text-[#9aa7b2]";
    awayColor = "text-[#9aa7b2]";
  }

  return (
    <motion.section
      layout
      className="relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 overflow-hidden border-b border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-2 sm:px-5 sm:py-3 md:gap-4"
    >
      <FlagBackdrop homeFlagUrl={homeFlagUrl} awayFlagUrl={awayFlagUrl} isDarkTheme={isDarkTheme} />
      <TeamPlate name={fixture.teamAName} subtitle={homeSubtitle} subtitleColor={homeColor} isDarkTheme={isDarkTheme} />
      <div className="relative z-10 text-center">
        <p
          className={cn(
            "hidden px-2 py-0.5 font-mono text-[0.58rem] font-semibold uppercase sm:block sm:text-[0.72rem]",
            isDarkTheme
              ? "bg-black/10 text-[var(--terminal-text-muted)]"
              : "bg-white/70 text-[var(--terminal-text-strong)]",
          )}
        >
          {fixture.stage ? `${fixture.competition} / ${fixture.stage}` : fixture.competition}
        </p>
        <div className="mt-1 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 font-display text-[2.25rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:mt-2 sm:px-8 sm:py-3 sm:text-[4rem]">
          {preKickoff ? "Kickoff" : `${fixture.scoreA} : ${fixture.scoreB}`}
        </div>
        <div
          className={cn(
            "mx-auto mt-1 w-fit border border-[var(--terminal-green)] px-2 py-1 font-mono text-[0.5rem] font-semibold uppercase sm:mt-2 sm:px-3 sm:text-[0.72rem]",
            isFinished
              ? "bg-[var(--terminal-green)] text-white"
              : "bg-emerald-500/10 text-[var(--terminal-green)]",
          )}
        >
          {centerBadgeText}
        </div>
        <LatencyReadout className="mt-1 text-[0.5rem] sm:mt-2 sm:text-[0.68rem]" />
      </div>
      <TeamPlate
        name={fixture.teamBName}
        subtitle={awaySubtitle}
        subtitleColor={awayColor}
        align="right"
        isDarkTheme={isDarkTheme}
      />
    </motion.section>
  );
}

function FlagBackdrop({
  awayFlagUrl,
  homeFlagUrl,
  isDarkTheme,
}: {
  awayFlagUrl: string | null;
  homeFlagUrl: string | null;
  isDarkTheme: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {homeFlagUrl ? (
        <div
          className={cn(
            "absolute inset-y-0 left-0 h-full w-1/2 object-cover",
            isDarkTheme ? "opacity-[0.34] saturate-[1.08]" : "opacity-[0.24] saturate-[1.06]",
          )}
          style={{ backgroundImage: `url(${homeFlagUrl})`, backgroundPosition: "center", backgroundSize: "cover" }}
        />
      ) : null}
      {awayFlagUrl ? (
        <div
          className={cn(
            "absolute inset-y-0 right-0 h-full w-1/2 object-cover",
            isDarkTheme ? "opacity-[0.34] saturate-[1.08]" : "opacity-[0.24] saturate-[1.06]",
          )}
          style={{ backgroundImage: `url(${awayFlagUrl})`, backgroundPosition: "center", backgroundSize: "cover" }}
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0",
          isDarkTheme
            ? "bg-[linear-gradient(90deg,rgba(13,19,25,0.98)_0%,rgba(255,255,255,0.18)_18%,rgba(255,255,255,0.08)_36%,rgba(13,19,25,0.86)_50%,rgba(255,255,255,0.08)_64%,rgba(255,255,255,0.18)_82%,rgba(13,19,25,0.98)_100%)]"
            : "bg-[linear-gradient(90deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.42)_18%,rgba(255,255,255,0.16)_35%,rgba(255,255,255,0.78)_50%,rgba(255,255,255,0.16)_65%,rgba(255,255,255,0.42)_82%,rgba(255,255,255,0.72)_100%)]",
        )}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-[40%] -translate-x-1/2",
          isDarkTheme
            ? "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.28),transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.76),rgba(255,255,255,0.5)_46%,rgba(255,255,255,0.12)_78%)]",
        )}
      />
    </div>
  );
}

function parseElapsedSeconds(minute: string) {
  const cleanMinute = minute.trim().toLowerCase();
  const stoppageMatch = cleanMinute.match(/(\d+)\s*\+\s*(\d+)/);
  if (stoppageMatch) {
    return (Number(stoppageMatch[1]) + Number(stoppageMatch[2])) * 60;
  }

  const minuteValue = Number.parseInt(cleanMinute.replace(/\D/g, ""), 10);
  return Number.isNaN(minuteValue) ? null : minuteValue * 60;
}

function structuralTimerLabel(phase: string, minute: string) {
  const value = `${phase} ${minute}`.toLowerCase();

  if (value.includes("half-time") || value.includes("halftime") || value.includes("interval")) return "HT";
  if (value.includes("pen")) return "PEN";
  if (value.includes("suspend") || value.includes("delay")) return "SUSP";
  if (value.includes("full") || value.includes("final") || value === "ft") return "FT";

  return null;
}

function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function useMatchTimer({
  enabled,
  lastUpdatedAt,
  minute,
  phase,
}: {
  enabled: boolean;
  lastUpdatedAt: string;
  minute: string;
  phase: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const frozenLabel = structuralTimerLabel(phase, minute);
  const baseElapsedSeconds = useMemo(() => parseElapsedSeconds(minute), [minute]);
  const lastUpdatedTime = useMemo(() => new Date(lastUpdatedAt).getTime(), [lastUpdatedAt]);

  useEffect(() => {
    if (!enabled || frozenLabel || baseElapsedSeconds === null || Number.isNaN(lastUpdatedTime)) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [baseElapsedSeconds, enabled, frozenLabel, lastUpdatedTime]);

  if (frozenLabel) return frozenLabel;
  if (!enabled || baseElapsedSeconds === null || Number.isNaN(lastUpdatedTime)) return minute || "LIVE";

  const secondsSinceUpdate = Math.max(0, (now - lastUpdatedTime) / 1000);
  return formatElapsedTime(baseElapsedSeconds + secondsSinceUpdate);
}

function TeamPlate({
  name,
  subtitle,
  subtitleColor,
  align = "left",
  isDarkTheme,
}: {
  name: string;
  subtitle: string | null;
  subtitleColor: string;
  align?: "left" | "right";
  isDarkTheme: boolean;
}) {
  return (
    <div
      className={cn(
        "relative z-10 flex min-w-0 items-center gap-2 sm:gap-4",
        align === "right" && "justify-end text-right",
        align !== "right" && "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-full px-2 py-1",
          align === "right" ? "sm:pl-4 sm:pr-3" : "sm:pl-3 sm:pr-4",
        )}
      >
        <p
          className={cn(
            "font-display text-[1rem] font-bold uppercase leading-none sm:text-[2.15rem]",
            isDarkTheme
              ? "text-[var(--terminal-text-strong)] drop-shadow-[0_1px_2px_rgba(255,255,255,0.22)]"
              : "text-[#050b1a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.34)]",
          )}
        >
          {name}
        </p>
        {subtitle ? (
          <p
            className={cn(
              "mt-1 font-mono text-[0.56rem] font-semibold uppercase sm:text-[0.72rem]",
              isDarkTheme && "drop-shadow-[0_1px_2px_rgba(255,255,255,0.2)]",
              subtitleColor,
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
