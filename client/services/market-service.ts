import { marketRowsSchema } from "@/schemas/market";
import { fetchFixtureIndex } from "@/services/fixture-service";
import {
  buildMarketPlaceholder,
  buildScoreLine,
  buildTimeLabel,
  createFixtureFromDto,
} from "@/services/pitchline-mappers";

export async function fetchMarketOverviewRows() {
  const fixtures = await fetchFixtureIndex();
  const rows = fixtures.map((dto) => {
    const fixture = createFixtureFromDto(dto);
    const placeholders = buildMarketPlaceholder(fixture);

    return {
      fixture,
      status: fixture.status,
      statusLabel:
        fixture.status === "live" ? "LIVE" : fixture.status === "finished" ? "FINAL" : "SCHEDULED",
      eventPair: `${fixture.teamACode} VS ${fixture.teamBCode}`,
      eventSubLabel: `${fixture.competition} / ${fixture.stage}`,
      scoreLine: buildScoreLine(fixture),
      timeLabel: buildTimeLabel(fixture),
      probabilities: {
        home: dto.homePct ?? 0,
        draw: dto.drawPct ?? 0,
        away: dto.awayPct ?? 0,
      },
      liquidity: placeholders.liquidity,
      depth: placeholders.depth,
      action: placeholders.action,
      actionTone: fixture.status === "live" ? "primary" : "secondary",
    };
  });

  return marketRowsSchema.parse(rows);
}
