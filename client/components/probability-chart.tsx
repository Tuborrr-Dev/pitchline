"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag, Search, ShieldAlert, Volleyball } from "lucide-react";
import { useTheme } from "next-themes";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineType,
  createChart,
  type AreaData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";

import type { ConnectionState, MarketAnalyticsData, MatchEvent, ProbabilityPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function toTime(timestamp: string): Time {
  return Math.floor(new Date(timestamp).getTime() / 1000) as Time;
}

function normalizeChartHistory(history: ProbabilityPoint[]) {
  const dedupedBySecond = new Map<number, ProbabilityPoint>();

  history.forEach((point) => {
    const time = new Date(point.timestamp).getTime();
    if (Number.isNaN(time)) return;

    dedupedBySecond.set(Math.floor(time / 1000), point);
  });

  return [...dedupedBySecond.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, point]) => point);
}

function parseMinuteLabel(minuteLabel: string) {
  return Number.parseInt(minuteLabel.replace(/\D/g, ""), 10) || 0;
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function findFocusedPoint(history: ProbabilityPoint[], selectedEvent?: MatchEvent | null) {
  if (history.length === 0) return null;
  if (!selectedEvent) return history[history.length - 1];

  const selectedMinute = parseMinuteLabel(selectedEvent.minuteLabel);
  let focusedPoint = history[0];

  for (const point of history) {
    if (parseMinuteLabel(point.minuteLabel) <= selectedMinute) {
      focusedPoint = point;
    }
  }

  return focusedPoint;
}

function getEventPointIndex(history: ProbabilityPoint[], event: MatchEvent) {
  const eventMinute = parseMinuteLabel(event.minuteLabel);
  let index = 0;

  history.forEach((point, pointIndex) => {
    if (parseMinuteLabel(point.minuteLabel) <= eventMinute) {
      index = pointIndex;
    }
  });

  return index;
}

function buildVix(history: ProbabilityPoint[]) {
  return history.map((point, index) => {
    const previous = history[index - 1];
    const shock = previous
      ? Math.abs(point.teamA - previous.teamA) + Math.abs(point.teamB - previous.teamB)
      : 4;

    return {
      index,
      minute: parseMinuteLabel(point.minuteLabel),
      value: Math.min(100, Math.max(8, shock * 3.4 + 10)),
    };
  });
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function interpolatePoint(fromPoint: ProbabilityPoint, toPoint: ProbabilityPoint, progress: number) {
  const eased = easeOutCubic(progress);

  return {
    ...toPoint,
    teamA: fromPoint.teamA + (toPoint.teamA - fromPoint.teamA) * eased,
    teamB: fromPoint.teamB + (toPoint.teamB - fromPoint.teamB) * eased,
    draw: fromPoint.draw + (toPoint.draw - fromPoint.draw) * eased,
  };
}

function interpolatePointTime(fromPoint: ProbabilityPoint, toPoint: ProbabilityPoint, progress: number) {
  const fromTime = new Date(fromPoint.timestamp).getTime();
  const toTimeValue = new Date(toPoint.timestamp).getTime();

  if (Number.isNaN(fromTime) || Number.isNaN(toTimeValue) || toTimeValue <= fromTime) {
    return toPoint.timestamp;
  }

  const eased = easeOutCubic(progress);
  const interpolatedTime = fromTime + (toTimeValue - fromTime) * eased;
  const minTime = fromTime + 1000;
  return new Date(Math.min(toTimeValue, Math.max(minTime, interpolatedTime))).toISOString();
}

function canAnimateLatestPoint(fromHistory: ProbabilityPoint[], toHistory: ProbabilityPoint[]) {
  if (fromHistory.length === 0 || toHistory.length === 0) return false;
  if (toHistory.length !== fromHistory.length && toHistory.length !== fromHistory.length + 1) {
    return false;
  }

  const stableLength = Math.min(fromHistory.length - 1, toHistory.length - 1);
  for (let index = 0; index < stableLength; index += 1) {
    if (fromHistory[index]?.timestamp !== toHistory[index]?.timestamp) return false;
  }

  return true;
}

function toSeriesData(animatedHistory: ProbabilityPoint[]) {
  return {
    teamA: animatedHistory.map(
      (point) => ({ time: toTime(point.timestamp), value: point.teamA }) satisfies AreaData,
    ),
    teamB: animatedHistory.map(
      (point) => ({ time: toTime(point.timestamp), value: point.teamB }) satisfies LineData,
    ),
    draw: animatedHistory.map(
      (point) => ({ time: toTime(point.timestamp), value: point.draw }) satisfies LineData,
    ),
  };
}

function eventMarkerTone(event: MatchEvent) {
  switch (event.type) {
    case "goal":
      return "border-[var(--terminal-green)] bg-emerald-500/10 text-[var(--terminal-green)] shadow-[0_0_18px_rgba(25,239,140,0.22)]";
    case "red-card":
      return "border-[#ff4b6e] bg-[#3a1622] text-[#ff8aa2] shadow-[0_0_18px_rgba(255,75,110,0.25)]";
    case "yellow-card":
      return "border-[#ffd700] bg-[#302509] text-[#ffe36d] shadow-[0_0_18px_rgba(255,215,0,0.2)]";
    case "penalty-awarded":
    case "penalty-scored":
    case "penalty-missed":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)] shadow-[0_0_18px_rgba(16,162,204,0.2)]";
    case "var":
      return "border-[var(--terminal-blue)] bg-sky-500/10 text-[var(--terminal-blue)] shadow-[0_0_18px_rgba(127,174,202,0.2)]";
    default:
      return "border-[var(--terminal-border)] bg-[var(--terminal-panel)] text-[var(--terminal-text-strong)] shadow-[0_0_18px_var(--terminal-shadow)]";
  }
}

function EventMarkerIcon({ event }: { event: MatchEvent }) {
  if (event.type === "goal") {
    return <Volleyball className="h-3.5 w-3.5" strokeWidth={2} />;
  }

  if (event.type === "red-card") {
    return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-current/90" />;
  }

  if (event.type === "yellow-card") {
    return <span className="block h-3.5 w-2.5 rounded-[1px] border border-current bg-[#ffd700]" />;
  }

  if (
    event.type === "penalty-awarded" ||
    event.type === "penalty-scored" ||
    event.type === "penalty-missed"
  ) {
    return <Flag className="h-3.5 w-3.5" strokeWidth={2} />;
  }

  if (event.type === "var") {
    return <Search className="h-3.5 w-3.5" strokeWidth={2} />;
  }

  return <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />;
}

function getVisibleVixPoints(
  vixPoints: ReturnType<typeof buildVix>,
  visibleLogicalRange: LogicalRange | null,
) {
  if (vixPoints.length === 0) return [];

  const range = visibleLogicalRange ?? {
    from: 0,
    to: Math.max(vixPoints.length - 1, 1),
  };
  const rangeSize = Math.max(1, range.to - range.from);

  return vixPoints.map((point) => ({
    ...point,
    x: ((point.index - range.from) / rangeSize) * 100,
    y: 100 - point.value,
  }));
}

function logicalIndexToPercent(index: number, visibleLogicalRange: LogicalRange | null, length: number) {
  const range = visibleLogicalRange ?? {
    from: 0,
    to: Math.max(length - 1, 1),
  };
  const rangeSize = Math.max(1, range.to - range.from);
  return ((index - range.from) / rangeSize) * 100;
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
    const initialSeriesData = toSeriesData(animationBaseHistory);
    teamASeriesRef.current.setData(initialSeriesData.teamA);
    teamBSeriesRef.current.setData(initialSeriesData.teamB);
    drawSeriesRef.current.setData(initialSeriesData.draw);
    displayedHistoryRef.current = animationBaseHistory;
    setRenderedHistory(animationBaseHistory);

    const renderFrame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const animatedPoint = {
        ...interpolatePoint(startPoint, targetPoint, progress),
        timestamp: progress >= 1 ? targetPoint.timestamp : interpolatePointTime(startPoint, targetPoint, progress),
        minuteLabel: targetPoint.minuteLabel,
      };

      const animTime = toTime(animatedPoint.timestamp);
      teamASeriesRef.current?.update({ time: animTime, value: animatedPoint.teamA });
      teamBSeriesRef.current?.update({ time: animTime, value: animatedPoint.teamB });
      drawSeriesRef.current?.update({ time: animTime, value: animatedPoint.draw });

      const animatedHistory = [...animationBaseHistory, animatedPoint];
      displayedHistoryRef.current = animatedHistory;

      if (!didFitContentRef.current) {
        chartRef.current?.timeScale().fitContent();
        didFitContentRef.current = true;
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const finalSeriesData = toSeriesData(normalizedHistory);
      teamASeriesRef.current?.setData(finalSeriesData.teamA);
      teamBSeriesRef.current?.setData(finalSeriesData.teamB);
      drawSeriesRef.current?.setData(finalSeriesData.draw);

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
      <div className="grid gap-0 border-b border-[var(--terminal-border)] bg-[var(--terminal-surface)] md:grid-cols-[1fr_auto]">
        <div className="flex overflow-x-auto border-b border-[var(--terminal-border)] [scrollbar-width:none] [-ms-overflow-style:none] md:grid md:grid-cols-4 md:overflow-visible md:border-b-0 [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[7rem] border-r border-[var(--terminal-border)] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[var(--terminal-text-muted)] sm:text-[0.64rem]">Focus</p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-[var(--terminal-text-strong)] sm:text-[1.45rem]">
              {inspectedPoint?.minuteLabel ?? "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[var(--terminal-text-muted)] sm:text-[0.68rem]">
              {inspectedPoint ? formatTimestamp(inspectedPoint.timestamp) : "Waiting"}
            </p>
          </div>
          <div className="min-w-[7rem] border-r border-[var(--terminal-border)] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[var(--terminal-green)] sm:text-[0.64rem]">
              {teamACode} Equity
            </p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-[var(--terminal-text-strong)] sm:text-[1.45rem]">
              {inspectedPoint ? `${inspectedPoint.teamA.toFixed(1)}%` : "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[var(--terminal-green)] sm:text-[0.68rem]">
              Live move {teamADelta >= 0 ? "+" : ""}
              {teamADelta.toFixed(1)}%
            </p>
          </div>
          <div className="min-w-[7rem] border-r border-[var(--terminal-border)] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[#ff4b6e] sm:text-[0.64rem]">
              {teamBCode} Equity
            </p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-[var(--terminal-text-strong)] sm:text-[1.45rem]">
              {inspectedPoint ? `${inspectedPoint.teamB.toFixed(1)}%` : "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[#ff8aa2] sm:text-[0.68rem]">
              Live move {teamBDelta >= 0 ? "+" : ""}
              {teamBDelta.toFixed(1)}%
            </p>
          </div>
          <div className="min-w-[7rem] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[#7faeca] sm:text-[0.64rem]">Draw / Parity</p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-[var(--terminal-text-strong)] sm:text-[1.45rem]">
              {inspectedPoint ? `${inspectedPoint.draw.toFixed(1)}%` : "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[var(--terminal-blue)] sm:text-[0.68rem]">Market reserve</p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-3 px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase md:flex md:min-w-[16rem]">
          <span className="text-[var(--terminal-green)]">{teamACode} Equity</span>
          <span className="text-[#ff4b6e]">{teamBCode} Equity</span>
          <span className="text-[#10a2cc]">DRAW</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(90deg,var(--terminal-grid-strong)_1px,transparent_1px),linear-gradient(var(--terminal-grid-strong)_1px,transparent_1px)] bg-[size:32px_32px]">
        <div ref={containerRef} className="h-[calc(100%-8.5rem)] min-h-[14rem] w-full sm:h-[calc(100%-11rem)] sm:min-h-[19rem]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[calc(100%-8.5rem)] min-h-[14rem] items-stretch justify-between px-[5.5%] sm:h-[calc(100%-11rem)] sm:min-h-[19rem]">
          {["23'", "36'", "HT", "58'", "90'", "108'", "118'", "PEN"].map((label) => (
            <div key={label} className="relative h-full border-l border-dashed border-[var(--terminal-border)]">
              <span className="absolute -bottom-5 -translate-x-1/2 font-mono text-[0.62rem] font-semibold uppercase text-[var(--terminal-text-muted)]">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-[5.5rem] h-12 border-t border-[var(--terminal-border)] bg-[var(--terminal-panel)]/95 sm:bottom-[8rem] sm:h-12">
          <div className="relative h-full w-full px-4 sm:px-5">
            {events.map((event, index) => {
          const pointIndex = getEventPointIndex(renderedHistory, event);
          const left = logicalIndexToPercent(pointIndex, visibleLogicalRange, renderedHistory.length);

          return (
            <motion.button
              key={event.eventId}
              type="button"
              onClick={() => onSelectEvent?.(event.eventId)}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: selectedEvent?.eventId === event.eventId ? 1.08 : 1,
              }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              whileHover={{ scale: 1.08 }}
              className={cn(
                "absolute top-1/2 z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-colors hover:z-30 sm:h-8 sm:w-8",
                eventMarkerTone(event),
                selectedEvent?.eventId === event.eventId && "ring-2 ring-white/80",
              )}
              style={{ left: `${left}%` }}
              aria-label={`${event.minuteLabel} ${event.label}`}
              title={`${event.minuteLabel} ${event.label}`}
            >
              <EventMarkerIcon event={event} />
            </motion.button>
          );
            })}
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[5.5rem] border-t border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2 sm:h-[8rem] sm:px-4 sm:py-3">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="vix-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10a2cc" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10a2cc" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              stroke="#10a2cc"
              strokeWidth="1.6"
              points={visibleVixPoints.map((point) => `${point.x},${point.y}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
            <polygon
              fill="url(#vix-fill)"
              points={`0,100 ${visibleVixPoints.map((point) => `${point.x},${point.y}`).join(" ")} 100,100`}
            />
          </svg>
          <div className="pointer-events-none absolute inset-x-3 top-2 flex justify-between font-mono text-[0.54rem] font-semibold uppercase text-[#0f9ac3] sm:inset-x-4 sm:text-[0.62rem]">
            <span>VIX Max {analytics?.volatility ? `· Volatility ${analytics.volatility.level}` : ""}</span>
            <span>{analytics?.momentum ? `Momentum: ${analytics.momentum.direction} (${analytics.momentum.slope > 0 ? "+" : ""}${analytics.momentum.slope})` : "Volatility shock index"}</span>
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between font-mono text-[0.54rem] font-semibold uppercase text-[#0f6c87] sm:inset-x-4 sm:text-[0.62rem]">
            <span>VIX Min {analytics?.volatility ? `(σ ${analytics.volatility.stdDev})` : ""}</span>
            <span>{connectionState === "live" ? "Live feed stable" : connectionState}</span>
          </div>
        </div>

        <AnimatePresence>
          {connectionState !== "live" ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
              className="pointer-events-none absolute left-4 top-4 z-30 border border-[var(--signal)] bg-yellow-500/10 px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase text-[#a37200]"
            >
              {connectionState === "connecting"
                ? "Connecting feed"
                : connectionState === "reconnecting"
                  ? "Reconnecting feed"
                  : "Feed paused"}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
