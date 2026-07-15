import { notFound } from "next/navigation";

import { LiveMatchTerminal } from "@/components/live-match-terminal";
import { getLiveReplayMatchState } from "@/lib/live-replay-data";
import { getLiveMatchState } from "@/lib/mock-data";
import { annotationsToMatchEvents } from "@/services/annotation-mappers";
import { fetchAnnotationHistory, fetchInitialLiveMatchState } from "@/services/match-service";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const replayState = await getLiveReplayMatchState(fixtureId);

  if (replayState) {
    return (
      <div className="h-full overflow-y-auto xl:overflow-hidden">
        <LiveMatchTerminal initialState={replayState} useMatchDataReplay />
      </div>
    );
  }

  const realState = await fetchInitialLiveMatchState(fixtureId);
  const mockState = getLiveMatchState(fixtureId);
  const mockAnnotationHistory =
    !realState && mockState ? await fetchAnnotationHistory(fixtureId) : [];
  const hydratedMockState =
    mockState && mockAnnotationHistory.length > 0
      ? {
          ...mockState,
          annotations: mockAnnotationHistory,
          events: annotationsToMatchEvents(mockAnnotationHistory, mockState.fixture),
        }
      : mockState;
  const state = realState ?? hydratedMockState;

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
