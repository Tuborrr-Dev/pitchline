import type { MarketOverviewRow } from "./types";

export function rowHref(row: MarketOverviewRow) {
  if (row.fixture.status === "finished") {
    return `/markets/history/${row.fixture.fixtureId}`;
  }

  return `/match/${row.fixture.fixtureId}`;
}

export function cleanLabel(value: string) {
  return value.replace("Ãƒâ€šÃ‚Â·", "/").replace("Ã‚Â·", "/");
}

export function isUpcomingRow(row: MarketOverviewRow) {
  return row.fixture.status === "upcoming";
}
