import { notFound } from "next/navigation";

import { HistoryMatchTerminal } from "@/components/history-match-terminal";
import { fetchInitialLiveMatchState } from "@/services/match-service";

export const dynamic = "force-dynamic";

export default async function MarketHistoryFixturePage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId } = await params;
  const state = await fetchInitialLiveMatchState(fixtureId);

  if (!state) {
    notFound();
  }

  return (
    <div className="h-full overflow-y-auto xl:overflow-hidden">
      <HistoryMatchTerminal initialState={state} />
    </div>
  );
}
