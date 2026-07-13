import type { MarketOverviewRow } from "./types";

export function rowHref(row: MarketOverviewRow) {
  return `/match/${row.fixture.fixtureId}`;
}

export function cleanLabel(value: string) {
  return value.replace("Ãƒâ€šÃ‚Â·", "/").replace("Ã‚Â·", "/");
}

export function isUpcomingRow(row: MarketOverviewRow) {
  return row.fixture.status === "upcoming";
}
