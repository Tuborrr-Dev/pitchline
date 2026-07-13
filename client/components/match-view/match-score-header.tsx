"use client";

import { motion } from "motion/react";

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

  return (
    <motion.section
      layout
      className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-[var(--terminal-border)] bg-[radial-gradient(circle_at_center,rgba(127,174,202,0.08),transparent_42%)] px-3 py-2 sm:px-5 sm:py-3 md:gap-4"
    >
      <TeamPlate code={fixture.teamACode} name={fixture.teamAName} probability={currentProbabilities.teamA} />
      <div className="text-center">
        <p className="hidden font-mono text-[0.58rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:block sm:text-[0.72rem]">
          {fixture.competition} / {fixture.stage}
        </p>
        <div className="mt-1 border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 font-display text-[2.25rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:mt-2 sm:px-8 sm:py-3 sm:text-[4rem]">
          {preKickoff ? "Kickoff" : `${fixture.scoreA} : ${fixture.scoreB}`}
        </div>
        <div className="mx-auto mt-1 w-fit border border-[var(--terminal-green)] bg-emerald-500/10 px-2 py-1 font-mono text-[0.5rem] font-semibold uppercase text-[var(--terminal-green)] sm:mt-2 sm:px-3 sm:text-[0.72rem]">
          {preKickoff
            ? `KO ${formatKickoffDate(fixture.kickoffUtc)} UTC`
            : `Market edge ${Math.abs(currentProbabilities.teamA - currentProbabilities.teamB).toFixed(1)} pts`}
        </div>
      </div>
      <TeamPlate
        code={fixture.teamBCode}
        name={fixture.teamBName}
        probability={currentProbabilities.teamB}
        align="right"
      />
    </motion.section>
  );
}

function TeamPlate({
  code,
  name,
  probability,
  align = "left",
}: {
  code: string;
  name: string;
  probability: number;
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
      {align === "left" ? (
        <span className="flex h-7 w-10 shrink-0 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-surface)] font-mono text-[0.62rem] font-semibold text-[var(--terminal-text-strong)] sm:h-12 sm:w-16 sm:text-sm">
          {code}
        </span>
      ) : null}
      <div>
        <p className="font-display text-[1rem] font-bold uppercase leading-none text-[var(--terminal-text-strong)] sm:text-[2.15rem]">
          {name}
        </p>
        <p className={cn("mt-1 font-mono text-[0.56rem] font-semibold uppercase sm:text-[0.72rem]", probability > 0 ? "text-[var(--terminal-green)]" : "text-[#9aa7b2]")}>
          Win {probability.toFixed(1)}%
        </p>
      </div>
      {align === "right" ? (
        <span className="flex h-7 w-10 shrink-0 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-surface)] font-mono text-[0.62rem] font-semibold text-[var(--terminal-text-strong)] sm:h-12 sm:w-16 sm:text-sm">
          {code}
        </span>
      ) : null}
    </div>
  );
}
