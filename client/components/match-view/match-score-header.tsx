"use client";

import { motion } from "motion/react";

import { TeamLogo } from "@/components/team-logo";
import type { LiveMatchState } from "@/lib/types";
import { cn } from "@/lib/utils";

import { formatKickoffDate, isPreKickoffFixture } from "./event-formatting";

export function MatchScoreHeader({
  currentProbabilities,
  fixture,
}: {
  currentProbabilities: LiveMatchState["currentProbabilities"];
  fixture: LiveMatchState["fixture"];
}) {
  const preKickoff = isPreKickoffFixture(fixture);
  const isFinished = fixture.status === "finished" || fixture.phase === "Finished" || fixture.phase === "FT";
  const hasOdds = currentProbabilities.teamA > 0 || currentProbabilities.teamB > 0;

  // Determine center badge text
  let centerBadgeText = "";
  if (isFinished) {
    centerBadgeText = "FULL TIME";
  } else if (preKickoff) {
    centerBadgeText = `KO ${formatKickoffDate(fixture.kickoffUtc)}`;
  } else if (!hasOdds) {
    centerBadgeText = "MARKET PENDING";
  } else {
    centerBadgeText = `Market edge ${Math.abs(currentProbabilities.teamA - currentProbabilities.teamB).toFixed(1)} pts`;
  }

  // Determine team subtitles
  let homeSubtitle = `Win ${currentProbabilities.teamA.toFixed(1)}%`;
  let awaySubtitle = `Win ${currentProbabilities.teamB.toFixed(1)}%`;
  let homeColor = currentProbabilities.teamA > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]";
  let awayColor = currentProbabilities.teamB > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]";

  if (isFinished) {
    if (fixture.scoreA > fixture.scoreB) {
      homeSubtitle = "Winner";
      homeColor = "text-[var(--terminal-green)]";
      awaySubtitle = "Defeated";
      awayColor = "text-[#9aa7b2]";
    } else if (fixture.scoreB > fixture.scoreA) {
      homeSubtitle = "Defeated";
      homeColor = "text-[#9aa7b2]";
      awaySubtitle = "Winner";
      awayColor = "text-[var(--terminal-green)]";
    } else {
      homeSubtitle = "Draw";
      homeColor = "text-[#9aa7b2]";
      awaySubtitle = "Draw";
      awayColor = "text-[#9aa7b2]";
    }
  } else if (!hasOdds && !preKickoff) {
    homeSubtitle = "Odds Pending";
    awaySubtitle = "Odds Pending";
    homeColor = "text-[#9aa7b2]";
    awayColor = "text-[#9aa7b2]";
  }

  return (
    <motion.section
      layout
      className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--terminal-border)] bg-[radial-gradient(circle_at_center,rgba(127,174,202,0.08),transparent_42%)] px-3 py-2 sm:px-5 sm:py-3 md:gap-4"
    >
      <TeamPlate code={fixture.teamACode} name={fixture.teamAName} subtitle={homeSubtitle} subtitleColor={homeColor} />
      <div className="text-center">
        <p className="hidden font-mono text-[0.58rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:block sm:text-[0.72rem]">
          {fixture.stage ? `${fixture.competition} / ${fixture.stage}` : fixture.competition}
        </p>
        <div className="mt-1 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 font-display text-[2.25rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:mt-2 sm:px-8 sm:py-3 sm:text-[4rem]">
          {preKickoff ? "Kickoff" : `${fixture.scoreA} : ${fixture.scoreB}`}
        </div>
        <div className="mx-auto mt-1 w-fit border border-[var(--terminal-green)] bg-emerald-500/10 px-2 py-1 font-mono text-[0.5rem] font-semibold uppercase text-[var(--terminal-green)] sm:mt-2 sm:px-3 sm:text-[0.72rem]">
          {centerBadgeText}
        </div>
      </div>
      <TeamPlate
        code={fixture.teamBCode}
        name={fixture.teamBName}
        subtitle={awaySubtitle}
        subtitleColor={awayColor}
        align="right"
      />
    </motion.section>
  );
}

function TeamPlate({
  code,
  name,
  subtitle,
  subtitleColor,
  align = "left",
}: {
  code: string;
  name: string;
  subtitle: string;
  subtitleColor: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-4",
        align === "right" && "justify-end text-right",
        align !== "right" && "justify-start",
      )}
    >
      {align === "left" ? <TeamLogo code={code} name={name} size="md" /> : null}
      <div>
        <p className="font-display text-[1rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:text-[2.15rem]">
          {name}
        </p>
        <p className={cn("mt-1 font-mono text-[0.56rem] font-semibold uppercase sm:text-[0.72rem]", subtitleColor)}>
          {subtitle}
        </p>
      </div>
      {align === "right" ? <TeamLogo code={code} name={name} size="md" /> : null}
    </div>
  );
}
