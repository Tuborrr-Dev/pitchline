"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";

import { TerminalState } from "@/components/terminal-state";
import type { ConnectionState, MarketAnalyticsData, MatchEvent, ProbabilityPoint } from "@/lib/types";

import { ChartHeader } from "./probability-chart/chart-header";
import {
  buildVix,
  canAnimateLatestPoint,
  findFocusedPoint,
  getVisibleVixPoints,
  interpolatePoint,
  interpolatePointTime,
  normalizeChartHistory,
  toSeriesData,
  toTime,
} from "./probability-chart/chart-utils";
import { EventMarkers } from "./probability-chart/event-markers";
import { FeedStatusBadge } from "./probability-chart/feed-status-badge";
import { TimeGrid } from "./probability-chart/time-grid";
import { VixPanel } from "./probability-chart/vix-panel";

interface ProbabilityChartProps {
  teamACode: string;
  teamBCode: string;
  history: ProbabilityPoint[];
  events: MatchEvent[];
  selectedEvent?: MatchEvent | null;
  connectionState: ConnectionState;
  analytics?: MarketAnalyticsData;
  onSelectEvent?: (eventId: string) => void;
}

export function ProbabilityChart({
  teamACode,
  teamBCode,
  history,
  events,
  selectedEvent,
  connectionState,
  analytics,
  onSelectEvent,
}: ProbabilityChartProps) {
  const { resolvedTheme } = useTheme();
  const normalizedHistory = useMemo(() => normalizeChartHistory(history), [history]);
  const hasHistory = normalizedHistory.length > 0;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const teamASeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const teamBSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const drawSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const historyRef = useRef<ProbabilityPoint[]>(normalizedHistory);
  const displayedHistoryRef = useRef<ProbabilityPoint[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const didFitContentRef = useRef(false);
  const previousThemeRef = useRef<string | undefined>(undefined);
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);
  const [visibleLogicalRange, setVisibleLogicalRange] = useState<LogicalRange | null>(null);
  const [renderedHistory, setRenderedHistory] = useState(normalizedHistory);

  const focusedPoint = useMemo(
    () => findFocusedPoint(renderedHistory, selectedEvent),
    [renderedHistory, selectedEvent],
  );
  const inspectedPoint =
    renderedHistory.find((point) => point.timestamp === hoveredTimestamp) ??
    focusedPoint ??
    renderedHistory[renderedHistory.length - 1] ??
    null;
  const latestPoint = renderedHistory[renderedHistory.length - 1] ?? null;
  const previousPoint = renderedHistory.length > 1 ? renderedHistory[renderedHistory.length - 2] : null;
  const teamADelta = latestPoint && previousPoint ? latestPoint.teamA - previousPoint.teamA : 0;
  const teamBDelta = latestPoint && previousPoint ? latestPoint.teamB - previousPoint.teamB : 0;
  const vixPoints = useMemo(() => buildVix(renderedHistory), [renderedHistory]);
  const visibleVixPoints = useMemo(
    () => getVisibleVixPoints(vixPoints, visibleLogicalRange),
    [visibleLogicalRange, vixPoints],
  );

  useEffect(() => {
    historyRef.current = normalizedHistory;
  }, [normalizedHistory]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const styles = getComputedStyle(document.documentElement);
    const chartTextColor = styles.getPropertyValue("--terminal-text-muted").trim() || "#9fb0bc";
    const chartGridColor = styles.getPropertyValue("--terminal-grid-strong").trim() || "rgba(127, 174, 202, 0.08)";
    const chartBorderColor = styles.getPropertyValue("--terminal-border").trim() || "rgba(127, 174, 202, 0.16)";
    const chartCrosshairBg = styles.getPropertyValue("--terminal-active-bg").trim() || "#06120d";
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        textColor: chartTextColor,
        background: { type: ColorType.Solid, color: "transparent" },
        fontFamily: "var(--font-ibm-plex-mono)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: chartGridColor },
        horzLines: { color: chartGridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(25, 239, 140, 0.35)",
          labelBackgroundColor: chartCrosshairBg,
        },
        horzLine: {
          color: "rgba(25, 239, 140, 0.22)",
          labelBackgroundColor: chartCrosshairBg,
        },
      },
      rightPriceScale: {
        borderColor: chartBorderColor,
        scaleMargins: { top: 0.08, bottom: 0.18 },
      },
      timeScale: {
        borderColor: chartBorderColor,
        timeVisible: false,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (value: number) => `${value.toFixed(0)}%`,
      },
    });

    const teamASeries = chart.addSeries(AreaSeries, {
      lineColor: "#00ff87",
      topColor: "rgba(0, 255, 135, 0.27)",
      bottomColor: "rgba(0, 255, 135, 0.02)",
      lineWidth: 3,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const teamBSeries = chart.addSeries(LineSeries, {
      color: "#ff4b6e",
      lineWidth: 3,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const drawSeries = chart.addSeries(LineSeries, {
      color: "#9ed2ef",
      lineWidth: 2,
      lineStyle: 0,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      if (!param.time) {
        setHoveredTimestamp(null);
        return;
      }

      const hoveredPoint = historyRef.current.find(
        (point) => toTime(point.timestamp) === param.time,
      );
      setHoveredTimestamp(hoveredPoint?.timestamp ?? null);
    };
    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      setVisibleLogicalRange(range);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      chart.applyOptions({ width, height });
    });

    resizeObserver.observe(container);
    didFitContentRef.current = false;
    chartRef.current = chart;
    teamASeriesRef.current = teamASeries;
    teamBSeriesRef.current = teamBSeries;
    drawSeriesRef.current = drawSeries;

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      chart.remove();
      chartRef.current = null;
      teamASeriesRef.current = null;
      teamBSeriesRef.current = null;
      drawSeriesRef.current = null;
    };
  }, [resolvedTheme]);

  useEffect(() => {
    if (!teamASeriesRef.current || !teamBSeriesRef.current || !drawSeriesRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const themeChanged = previousThemeRef.current !== resolvedTheme;
    previousThemeRef.current = resolvedTheme;

    if (themeChanged) {
      const seriesData = toSeriesData(normalizedHistory);
      teamASeriesRef.current.setData(seriesData.teamA);
      teamBSeriesRef.current.setData(seriesData.teamB);
      drawSeriesRef.current.setData(seriesData.draw);
      displayedHistoryRef.current = normalizedHistory;
      setRenderedHistory(normalizedHistory);
      chartRef.current?.timeScale().fitContent();
      didFitContentRef.current = true;
      return;
    }

    const fromHistory =
      displayedHistoryRef.current.length > 0 ? displayedHistoryRef.current : normalizedHistory;
    const startedAt = performance.now();
    const duration = 760;
    const shouldAnimateLatestPoint = canAnimateLatestPoint(fromHistory, normalizedHistory);

    if (!shouldAnimateLatestPoint) {
      const seriesData = toSeriesData(normalizedHistory);
      teamASeriesRef.current.setData(seriesData.teamA);
      teamBSeriesRef.current.setData(seriesData.teamB);
      drawSeriesRef.current.setData(seriesData.draw);
      displayedHistoryRef.current = normalizedHistory;
      setRenderedHistory(normalizedHistory);

      if (!didFitContentRef.current) {
        chartRef.current?.timeScale().fitContent();
        didFitContentRef.current = true;
      }

      return;
    }

    const targetPoint = normalizedHistory[normalizedHistory.length - 1];
    const previousTargetPoint = normalizedHistory[normalizedHistory.length - 2] ?? targetPoint;
    const sourcePoint =
      fromHistory.find((point) => point.timestamp === targetPoint.timestamp) ??
      fromHistory[fromHistory.length - 1] ??
      previousTargetPoint;
    const startPoint = {
      ...targetPoint,
      timestamp: previousTargetPoint.timestamp,
      minuteLabel: previousTargetPoint.minuteLabel,
      teamA: sourcePoint.teamA,
      teamB: sourcePoint.teamB,
      draw: sourcePoint.draw,
    };
    const animationBaseHistory = normalizedHistory.slice(0, -1);

    displayedHistoryRef.current = animationBaseHistory;
    setRenderedHistory(animationBaseHistory);

    const renderFrame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const animatedPoint = {
        ...interpolatePoint(startPoint, targetPoint, progress),
        timestamp: progress >= 1 ? targetPoint.timestamp : interpolatePointTime(startPoint, targetPoint, progress),
        minuteLabel: targetPoint.minuteLabel,
      };
      const animatedHistory = [...animationBaseHistory, animatedPoint];
      const animatedSeriesData = toSeriesData(animatedHistory);

      teamASeriesRef.current?.setData(animatedSeriesData.teamA);
      teamBSeriesRef.current?.setData(animatedSeriesData.teamB);
      drawSeriesRef.current?.setData(animatedSeriesData.draw);
      displayedHistoryRef.current = animatedHistory;
      setRenderedHistory(animatedHistory);

      if (!didFitContentRef.current) {
        chartRef.current?.timeScale().fitContent();
        didFitContentRef.current = true;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      displayedHistoryRef.current = normalizedHistory;
      setRenderedHistory(normalizedHistory);
      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [normalizedHistory, resolvedTheme]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-[calc(100dvh-19rem)] min-h-[26rem] w-full flex-col border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:h-[calc(100dvh-20rem)] sm:min-h-[30rem] xl:h-full xl:min-h-0"
    >
      <ChartHeader
        inspectedPoint={inspectedPoint}
        teamACode={teamACode}
        teamADelta={teamADelta}
        teamBCode={teamBCode}
        teamBDelta={teamBDelta}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(90deg,var(--terminal-grid-strong)_1px,transparent_1px),linear-gradient(var(--terminal-grid-strong)_1px,transparent_1px)] bg-[size:32px_32px]">
        <div ref={containerRef} className="h-[calc(100%-8.5rem)] min-h-[14rem] w-full sm:h-[calc(100%-11rem)] sm:min-h-[19rem]" />

        <TimeGrid />
        {!hasHistory ? (
          <div className="absolute inset-x-3 top-14 z-10 sm:inset-x-5 sm:top-20">
            <TerminalState
              icon={Activity}
              title="Waiting for probability history"
              description="The chart will render once the match feed returns validated market probability points."
              tone="blue"
              className="min-h-[12rem] bg-[var(--terminal-panel)]/95"
            />
          </div>
        ) : null}
        <EventMarkers
          events={events}
          onSelectEvent={onSelectEvent}
          renderedHistory={renderedHistory}
          selectedEvent={selectedEvent}
          visibleLogicalRange={visibleLogicalRange}
        />
        <VixPanel analytics={analytics} connectionState={connectionState} visibleVixPoints={visibleVixPoints} />
        <FeedStatusBadge connectionState={connectionState} />
      </div>
    </motion.section>
  );
}
