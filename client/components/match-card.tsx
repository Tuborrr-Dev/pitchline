"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { MatchCountdownTimer } from "@/components/match-countdown-timer";
import { TeamLogo } from "@/components/team-logo";
import { getHistoryByFixtureId } from "@/lib/mock-data";
import type { Fixture } from "@/lib/types";

import { MiniSparkline } from "./mini-sparkline";

const MotionLink = motion.create(Link);

export function MatchCard({ fixture }: { fixture: Fixture }) {
  const points = getHistoryByFixtureId(fixture.fixtureId).map((point) => point.teamA);

  return (
    <MotionLink
      href={`/match/${fixture.fixtureId}`}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="group relative flex flex-col gap-5 overflow-hidden rounded-[2rem] border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5 shadow-sm transition-colors duration-300 hover:border-[var(--terminal-blue)] hover:bg-[var(--terminal-surface)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[var(--terminal-text-muted)]">
            {fixture.competition} · {fixture.stage}
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <TeamLogo code={fixture.teamACode} name={fixture.teamAName} size="sm" />
              <span className="text-base font-medium text-[var(--terminal-text-strong)] transition-colors group-hover:text-[var(--terminal-blue)]">
                {fixture.teamAName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <TeamLogo code={fixture.teamBCode} name={fixture.teamBName} size="sm" />
              <span className="text-base font-medium text-[var(--terminal-text-strong)] transition-colors group-hover:text-[var(--terminal-blue)]">
                {fixture.teamBName}
              </span>
            </div>
          </div>
        </div>
        <MatchCountdownTimer
          kickoffUtc={fixture.kickoffUtc}
          status={fixture.status}
          phase={fixture.phase}
          minute={fixture.minute}
          variant="badge"
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight text-[var(--terminal-text-strong)]">
            {fixture.scoreA}
            <span className="mx-2 text-[var(--terminal-text-muted)]">:</span>
            {fixture.scoreB}
          </p>
          <div className="text-xs">
            <MatchCountdownTimer
              kickoffUtc={fixture.kickoffUtc}
              status={fixture.status}
              phase={fixture.phase}
              minute={fixture.minute}
              variant="compact"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--terminal-line)] bg-[var(--terminal-surface)] p-3">
          <div className="mb-2 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.2em] text-[var(--terminal-text-muted)]">
            <span>Market Line</span>
            <span className="font-mono font-semibold text-[var(--terminal-blue)]">{fixture.teamACode} {fixture.leadProbability.toFixed(1)}%</span>
          </div>
          <MiniSparkline values={points} />
        </div>
      </div>
    </MotionLink>
  );
}

