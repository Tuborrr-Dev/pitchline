import { notFound } from "next/navigation";

import { LiveMatchTerminal } from "@/components/live-match-terminal";
import { getLiveMatchState } from "@/lib/mock-data";
import { fetchInitialLiveMatchState } from "@/lib/pitchline-service";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const realState = await fetchInitialLiveMatchState(fixtureId);
  const mockState = getLiveMatchState(fixtureId);
  const state = realState ?? mockState;

  if (!state) {
    notFound();
  }

  const isMockData = !realState && Boolean(mockState);

  return (
    <div className="h-full overflow-y-auto xl:overflow-hidden">
      <LiveMatchTerminal initialState={state} useMockReplay={isMockData} />
    </div>
  );
}
