import { notFound } from "next/navigation";

import { LiveMatchTerminal } from "@/components/live-match-terminal";
import { getLiveMatchState } from "@/lib/mock-data";
import { fetchInitialLiveMatchState } from "@/lib/pitchline-service";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const mockState = getLiveMatchState(fixtureId);
  const state = mockState ?? (await fetchInitialLiveMatchState(fixtureId));

  if (!state) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto xl:overflow-hidden">
      <LiveMatchTerminal initialState={state} useMockReplay={Boolean(mockState)} />
    </div>
  );
}
