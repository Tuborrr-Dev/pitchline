"use client";

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useEffect, useEffectEvent, useState } from "react";

import type { MarketOverviewRow } from "@/lib/market-service";
import { getApiBaseUrl } from "@/lib/pitchline-service";

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

export function useMarketOverviewStream(initialRows: MarketOverviewRow[], enabled = true) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const handleOddsUpdate = useEffectEvent((payload: OddsPayload) => {
    setRows((current) =>
      current.map((row) => {
        if (String(row.fixture.fixtureId) !== String(payload.fixtureId)) return row;
        return {
          ...row,
          probabilities: {
            home: payload.homePct,
            draw: payload.drawPct,
            away: payload.awayPct,
          },
        };
      }),
    );
  });

  const handleScoreUpdate = useEffectEvent((payload: ScorePayload) => {
    setRows((current) =>
      current.map((row) => {
        if (String(row.fixture.fixtureId) !== String(payload.fixtureId)) return row;
        const cleanMinute = (payload.minute ?? "").trim();
        const minuteDisplay = cleanMinute ? (cleanMinute.includes("'") ? cleanMinute : `${cleanMinute}'`) : "0'";
        const phaseDisplay = payload.gameState?.trim() || "LIVE";

        return {
          ...row,
          status: "live",
          statusLabel: "LIVE",
          actionTone: "primary",
          scoreLine: `${payload.homeScore} - ${payload.awayScore}`,
          timeLabel: `${phaseDisplay} / ${minuteDisplay}`,
          fixture: {
            ...row.fixture,
            scoreA: payload.homeScore,
            scoreB: payload.awayScore,
            status: "live",
            phase: phaseDisplay,
            minute: minuteDisplay,
          },
        };
      }),
    );
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
        await connection.invoke("JoinLobby");
      })
      .catch((error) => {
        if (isDisposed) return;
        const msg = String(error).toLowerCase();
        if (msg.includes("stopped") || msg.includes("negotiation")) return;
        console.warn("[SignalR Lobby Connection Failed]", error);
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
