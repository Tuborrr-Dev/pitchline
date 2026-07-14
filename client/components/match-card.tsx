import Link from "next/link";

import { TeamLogo } from "@/components/team-logo";
import { getHistoryByFixtureId } from "@/lib/mock-data";
import type { Fixture } from "@/lib/types";

import { MiniSparkline } from "./mini-sparkline";

function formatKickoff(kickoffUtc: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(kickoffUtc));
}

const statusTone = {
  live: "border-emerald-400/20 bg-emerald-400/12 text-emerald-200",
  upcoming: "border-white/12 bg-white/6 text-slate-300",
  finished: "border-white/12 bg-white/6 text-slate-300",
};

export function MatchCard({ fixture }: { fixture: Fixture }) {
  const points = getHistoryByFixtureId(fixture.fixtureId).map((point) => point.teamA);

  return (
    <Link
      href={`/match/${fixture.fixtureId}`}
      className="group flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-[0_20px_60px_rgba(3,8,20,0.35)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.065]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {fixture.competition} · {fixture.stage}
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3">
              <TeamLogo code={fixture.teamACode} name={fixture.teamAName} size="sm" />
              <span className="text-base font-medium text-white">{fixture.teamAName}</span>
            </div>
            <div className="flex items-center gap-3">
              <TeamLogo code={fixture.teamBCode} name={fixture.teamBName} size="sm" />
              <span className="text-base font-medium text-white">{fixture.teamBName}</span>
            </div>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] ${statusTone[fixture.status]}`}
        >
          {fixture.status}
        </span>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-end gap-4">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight text-white">
            {fixture.scoreA}
            <span className="mx-2 text-slate-500">:</span>
            {fixture.scoreB}
          </p>
          <p className="text-sm text-slate-400">
            {fixture.status === "live" ? `${fixture.phase} · ${fixture.minute}` : formatKickoff(fixture.kickoffUtc)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">
            <span>Market Line</span>
            <span>{fixture.teamACode} {fixture.leadProbability.toFixed(1)}%</span>
          </div>
          <MiniSparkline values={points} />
        </div>
      </div>
    </Link>
  );
}
