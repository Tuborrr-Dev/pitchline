"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { getApiBaseUrl } from "@/config/api";
import type { MarketOverviewRow } from "@/schemas/market";

type OddsPayload = {
  fixtureId: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
};

type ScorePayload = {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  minute?: string | null;
  gameState?: string | null;
};

type RowPatch = Omit<Partial<MarketOverviewRow>, "fixture" | "probabilities"> & {
  fixture?: Partial<MarketOverviewRow["fixture"]>;
  probabilities?: Partial<MarketOverviewRow["probabilities"]>;
};

function mergeRowPatch(row: MarketOverviewRow, patch: RowPatch): MarketOverviewRow {
  return {
    ...row,
    ...patch,
    fixture: {
      ...row.fixture,
      ...patch.fixture,
    },
    probabilities: {
      ...row.probabilities,
      ...patch.probabilities,
    },
  };
}

export function useMarketOverviewStream(initialRows: MarketOverviewRow[], enabled = true) {
  const [patchesByFixtureId, setPatchesByFixtureId] = useState<Record<string, RowPatch>>({});

  const rows = useMemo(
    () =>
      initialRows.map((row) => {
        const patch = patchesByFixtureId[String(row.fixture.fixtureId)];
        return patch ? mergeRowPatch(row, patch) : row;
      }),
    [initialRows, patchesByFixtureId],
  );

  const handleOddsUpdate = useEffectEvent((payload: OddsPayload) => {
    setPatchesByFixtureId((current) => ({
      ...current,
      [String(payload.fixtureId)]: {
        ...current[String(payload.fixtureId)],
        probabilities: {
          home: payload.homePct,
          draw: payload.drawPct,
          away: payload.awayPct,
        },
      },
    }));
  });

  const handleScoreUpdate = useEffectEvent((payload: ScorePayload) => {
    const cleanMinute = (payload.minute ?? "").trim();
    const minuteDisplay = cleanMinute ? (cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`) : "0'";
    const phaseDisplay = payload.gameState?.trim() || "LIVE";

    setPatchesByFixtureId((current) => ({
      ...current,
      [String(payload.fixtureId)]: {
        ...current[String(payload.fixtureId)],
        status: "live",
        statusLabel: "LIVE",
        actionTone: "primary",
        scoreLine: `${payload.homeScore} - ${payload.awayScore}`,
        timeLabel: `${phaseDisplay} / ${minuteDisplay}`,
        fixture: {
          ...current[String(payload.fixtureId)]?.fixture,
          scoreA: payload.homeScore,
          scoreB: payload.awayScore,
          status: "live",
          phase: phaseDisplay,
          minute: minuteDisplay,
        },
      },
    }));
  });

  useEffect(() => {
    if (!enabled) return;

    let isDisposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiBaseUrl()}/hubs/match`)
      .withAutomaticReconnect()
      .configureLogging({
        log: (level, message) => {
          if (
            isDisposed &&
            (message.includes("stopped during negotiation") ||
              message.includes("failed to complete negotiation") ||
              message.includes("negotiation"))
          ) {
            return;
          }
          if (level >= LogLevel.Error) {
            console.error(message);
          }
        },
      })
      .build();

    connection.on("OddsUpdate", handleOddsUpdate);
    connection.on("ScoreUpdate", handleScoreUpdate);

    void connection
      .start()
      .then(async () => {
        if (isDisposed) return;
        try {
          await connection.invoke("JoinLobby");
        } catch (err) {
          if (!isDisposed) {
            console.debug("[SignalR] JoinLobby invoke skipped or handled:", err);
          }
        }
      })
      .catch((error) => {
        if (isDisposed) return;
        const msg = String(error).toLowerCase();
        if (msg.includes("stopped") || msg.includes("negotiation")) return;
        console.warn("[SignalR Lobby Connection Error]", error);
      });

    return () => {
      isDisposed = true;
      connection.off("OddsUpdate", handleOddsUpdate);
      connection.off("ScoreUpdate", handleScoreUpdate);

      if (connection.state === "Connected") {
        connection
          .invoke("LeaveLobby")
          .catch(() => undefined)
          .finally(() => {
            void connection.stop().catch(() => undefined);
          });
      } else {
        void connection.stop().catch(() => undefined);
      }
    };
  }, [enabled]);

  return rows;
}
