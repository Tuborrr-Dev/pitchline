"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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

import type { ConnectionState, MatchEvent, ProbabilityPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProbabilityChartProps {
  teamACode: string;
  teamBCode: string;
  history: ProbabilityPoint[];
  events: MatchEvent[];
  selectedEvent?: MatchEvent | null;
  connectionState: ConnectionState;
  onSelectEvent?: (eventId: string) => void;
}

function toTime(timestamp: string): Time {
  return Math.floor(new Date(timestamp).getTime() / 1000) as Time;
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

function getEventPoint(history: ProbabilityPoint[], event: MatchEvent) {
  const eventMinute = parseMinuteLabel(event.minuteLabel);
  let point = history[0];

  for (const item of history) {
    if (parseMinuteLabel(item.minuteLabel) <= eventMinute) {
      point = item;
    }
  }

  return point;
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

function canAnimateLatestPoint(fromHistory: ProbabilityPoint[], toHistory: ProbabilityPoint[]) {
  if (fromHistory.length === 0 || toHistory.length === 0) return false;
  if (toHistory.length < fromHistory.length || toHistory.length > fromHistory.length + 1) {
    return false;
  }

  const stableLength = toHistory.length - 1;
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

function eventColor(event: MatchEvent) {
  if (event.side === "teamB") return "border-[#ff4b6e] bg-[#3a1622] text-[#ff8aa2] shadow-[0_0_22px_rgba(255,75,110,0.22)]";
  if (event.side === "teamA") return "border-[var(--terminal-green)] bg-[#073525] text-[#65ffb8] shadow-[0_0_22px_rgba(25,239,140,0.22)]";
  return "border-[#ffd700] bg-[#302509] text-[#ffe36d] shadow-[0_0_22px_rgba(255,215,0,0.18)]";
}

function eventShortLabel(event: MatchEvent) {
  const side = event.side === "teamB" ? "FRA" : event.side === "teamA" ? "ARG" : "MKT";
  const delta = event.delta ? `${event.delta > 0 ? "+" : ""}${event.delta.toFixed(1)}%` : "Market";
  return `${event.minuteLabel} ${event.label} ${delta} ${side}`;
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
  onSelectEvent,
}: ProbabilityChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const teamASeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const teamBSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const drawSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const historyRef = useRef<ProbabilityPoint[]>(history);
  const displayedHistoryRef = useRef<ProbabilityPoint[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const didFitContentRef = useRef(false);
  const [hoveredTimestamp, setHoveredTimestamp] = useState<string | null>(null);
  const [visibleLogicalRange, setVisibleLogicalRange] = useState<LogicalRange | null>(null);
  const [renderedHistory, setRenderedHistory] = useState(history);

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
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        textColor: "#9fb0bc",
        background: { type: ColorType.Solid, color: "transparent" },
        fontFamily: "var(--font-ibm-plex-mono)",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(127, 174, 202, 0.08)" },
        horzLines: { color: "rgba(127, 174, 202, 0.08)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(25, 239, 140, 0.35)",
          labelBackgroundColor: "#06120d",
        },
        horzLine: {
          color: "rgba(25, 239, 140, 0.22)",
          labelBackgroundColor: "#06120d",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(127, 174, 202, 0.16)",
        scaleMargins: { top: 0.08, bottom: 0.18 },
      },
      timeScale: {
        borderColor: "rgba(127, 174, 202, 0.16)",
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
      color: "rgba(127,174,202,0.45)",
      lineWidth: 1,
      lineStyle: 2,
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
  }, []);

  useEffect(() => {
    if (!teamASeriesRef.current || !teamBSeriesRef.current || !drawSeriesRef.current) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const fromHistory = displayedHistoryRef.current.length > 0 ? displayedHistoryRef.current : history;
    const startedAt = performance.now();
    const duration = 560;
    const shouldAnimateLatestPoint = canAnimateLatestPoint(fromHistory, history);

    if (!shouldAnimateLatestPoint) {
      const seriesData = toSeriesData(history);
      teamASeriesRef.current.setData(seriesData.teamA);
      teamBSeriesRef.current.setData(seriesData.teamB);
      drawSeriesRef.current.setData(seriesData.draw);
      displayedHistoryRef.current = history;
      setRenderedHistory(history);

      if (!didFitContentRef.current) {
        chartRef.current?.timeScale().fitContent();
        didFitContentRef.current = true;
      }

      return;
    }

    const targetPoint = history[history.length - 1];
    const sourcePoint =
      fromHistory.find((point) => point.timestamp === targetPoint.timestamp) ??
      fromHistory[fromHistory.length - 1] ??
      targetPoint;
    const startPoint = {
      ...targetPoint,
      teamA: sourcePoint.teamA,
      teamB: sourcePoint.teamB,
      draw: sourcePoint.draw,
    };
    const stableHistory = [...history.slice(0, -1), startPoint];
    const stableSeriesData = toSeriesData(stableHistory);

    teamASeriesRef.current.setData(stableSeriesData.teamA);
    teamBSeriesRef.current.setData(stableSeriesData.teamB);
    drawSeriesRef.current.setData(stableSeriesData.draw);
    displayedHistoryRef.current = stableHistory;

    const renderFrame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const animatedPoint = interpolatePoint(startPoint, targetPoint, progress);
      const animatedHistory = [...history.slice(0, -1), animatedPoint];

      teamASeriesRef.current?.update({
        time: toTime(animatedPoint.timestamp),
        value: animatedPoint.teamA,
      });
      teamBSeriesRef.current?.update({
        time: toTime(animatedPoint.timestamp),
        value: animatedPoint.teamB,
      });
      drawSeriesRef.current?.update({
        time: toTime(animatedPoint.timestamp),
        value: animatedPoint.draw,
      });
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

      displayedHistoryRef.current = history;
      setRenderedHistory(history);
      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);
  }, [history]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-[calc(100dvh-19rem)] min-h-[26rem] w-full flex-col border border-[var(--terminal-border)] bg-[#080d12] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:h-[calc(100dvh-20rem)] sm:min-h-[30rem] xl:h-full xl:min-h-0"
    >
      <div className="grid gap-0 border-b border-[var(--terminal-border)] bg-[#0a1117] md:grid-cols-[1fr_auto]">
        <div className="flex overflow-x-auto border-b border-[var(--terminal-border)] [scrollbar-width:none] [-ms-overflow-style:none] md:grid md:grid-cols-4 md:overflow-visible md:border-b-0 [&::-webkit-scrollbar]:hidden">
          <div className="min-w-[7rem] border-r border-[var(--terminal-border)] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[#6f7b84] sm:text-[0.64rem]">Focus</p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-white sm:text-[1.45rem]">
              {inspectedPoint?.minuteLabel ?? "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[#8795a0] sm:text-[0.68rem]">
              {inspectedPoint ? formatTimestamp(inspectedPoint.timestamp) : "Waiting"}
            </p>
          </div>
          <div className="min-w-[7rem] border-r border-[var(--terminal-border)] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[var(--terminal-green)] sm:text-[0.64rem]">
              {teamACode} Equity
            </p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-white sm:text-[1.45rem]">
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
            <p className="font-display text-[1.05rem] font-bold uppercase text-white sm:text-[1.45rem]">
              {inspectedPoint ? `${inspectedPoint.teamB.toFixed(1)}%` : "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[#ff8aa2] sm:text-[0.68rem]">
              Live move {teamBDelta >= 0 ? "+" : ""}
              {teamBDelta.toFixed(1)}%
            </p>
          </div>
          <div className="min-w-[7rem] px-2 py-1.5 sm:min-w-[8.5rem] sm:px-3 sm:py-2 md:min-w-0">
            <p className="font-mono text-[0.56rem] font-semibold uppercase text-[#7faeca] sm:text-[0.64rem]">Draw / Parity</p>
            <p className="font-display text-[1.05rem] font-bold uppercase text-white sm:text-[1.45rem]">
              {inspectedPoint ? `${inspectedPoint.draw.toFixed(1)}%` : "--"}
            </p>
            <p className="font-mono text-[0.58rem] uppercase text-[#9ed2ef] sm:text-[0.68rem]">Market reserve</p>
          </div>
        </div>

        <div className="hidden flex-wrap items-center justify-between gap-3 px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase md:flex md:min-w-[16rem]">
          <span className="text-[var(--terminal-green)]">ARG Equity</span>
          <span className="text-[#ff4b6e]">FRA Equity</span>
          <span className="text-[#10a2cc]">VIX</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(90deg,rgba(127,174,202,0.07)_1px,transparent_1px),linear-gradient(rgba(127,174,202,0.07)_1px,transparent_1px)] bg-[size:32px_32px]">
        <div ref={containerRef} className="h-[calc(100%-5.5rem)] min-h-[17rem] w-full sm:h-[calc(100%-8rem)] sm:min-h-[22rem]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[calc(100%-5.5rem)] min-h-[17rem] items-stretch justify-between px-[5.5%] sm:h-[calc(100%-8rem)] sm:min-h-[22rem]">
          {["23'", "36'", "HT", "58'", "90'", "108'", "118'", "PEN"].map((label) => (
            <div key={label} className="relative h-full border-l border-dashed border-[#28404a]/70">
              <span className="absolute -bottom-5 -translate-x-1/2 font-mono text-[0.62rem] font-semibold uppercase text-[#78858f]">
                {label}
              </span>
            </div>
          ))}
        </div>

        {events.map((event, index) => {
          const point = getEventPoint(renderedHistory, event);
          const pointIndex = getEventPointIndex(renderedHistory, event);
          const left = logicalIndexToPercent(pointIndex, visibleLogicalRange, renderedHistory.length);
          const topValue = event.side === "teamB" ? point.teamB : point.teamA;
          const top = Math.min(78, Math.max(10, 100 - topValue));

          return (
            <motion.button
              key={event.eventId}
              type="button"
              onClick={() => onSelectEvent?.(event.eventId)}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: selectedEvent?.eventId === event.eventId ? 1.04 : 1,
              }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              whileHover={{ scale: 1.04 }}
              className={cn(
                "absolute z-20 max-w-[7.5rem] -translate-x-1/2 border px-1.5 py-1 text-left font-mono text-[0.52rem] font-semibold uppercase leading-3 transition-colors hover:z-30 sm:max-w-[11rem] sm:px-2 sm:text-[0.62rem] sm:leading-4",
                eventColor(event),
                selectedEvent?.eventId === event.eventId && "ring-1 ring-white/80",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              {eventShortLabel(event)}
            </motion.button>
          );
        })}

        <div className="absolute inset-x-0 bottom-0 h-[5.5rem] border-t border-[var(--terminal-border)] bg-[#071018] px-3 py-2 sm:h-[8rem] sm:px-4 sm:py-3">
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
            <span>VIX Max</span>
            <span>Volatility shock index</span>
          </div>
          <div className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between font-mono text-[0.54rem] font-semibold uppercase text-[#0f6c87] sm:inset-x-4 sm:text-[0.62rem]">
            <span>VIX Min</span>
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
              className="pointer-events-none absolute left-4 top-4 z-30 border border-[#ffd700] bg-[#211b08] px-3 py-2 font-mono text-[0.68rem] font-semibold uppercase text-[#ffe36d]"
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
