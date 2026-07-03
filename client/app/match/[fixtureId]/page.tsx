import { notFound } from "next/navigation";

import { LiveMatchTerminal } from "@/components/live-match-terminal";
import { getLiveMatchState } from "@/lib/mock-data";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const state = getLiveMatchState(fixtureId);

  if (!state) {
    notFound();
  }

  return (
    <div className="h-full overflow-hidden">
      <LiveMatchTerminal initialState={state} />
    </div>
  );
}
