import type { AreaData, LineData, LogicalRange, Time } from "lightweight-charts";

import type { MatchEvent, ProbabilityPoint } from "@/lib/types";

const CHART_CLOCK_EPOCH_SECONDS = 946684800;

export function toTime(timestamp: string): Time {
  return Math.floor(new Date(timestamp).getTime() / 1000) as Time;
}

export function toChartTime(second: number): Time {
  return (CHART_CLOCK_EPOCH_SECONDS + second) as Time;
}

export function normalizeChartHistory(history: ProbabilityPoint[]) {
  let previousSecond = 0;

  return history.map((point, index) => {
    const parsedTime = new Date(point.timestamp).getTime();
    const parsedSecond = Number.isNaN(parsedTime) ? Number.NaN : Math.floor(parsedTime / 1000);
    const nextSecond = Number.isNaN(parsedSecond) || parsedSecond <= previousSecond
      ? previousSecond + 1
      : parsedSecond;

    previousSecond = nextSecond;

    if (nextSecond === parsedSecond) {
      return point;
    }

    return {
      ...point,
      timestamp: new Date(nextSecond * 1000).toISOString(),
      minuteLabel: point.minuteLabel || `${index}'`,
    };
  });
}

export function parseMinuteLabel(minuteLabel: string) {
  const match = minuteLabel.match(/(\d+)(?:\s*\+\s*(\d+))?/);
  if (!match) return 0;

  return Number.parseInt(match[1], 10) + Number.parseInt(match[2] ?? "0", 10);
}

export function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function findFocusedPoint(history: ProbabilityPoint[], selectedEvent?: MatchEvent | null) {
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

export function getEventPointIndex(history: ProbabilityPoint[], event: MatchEvent) {
  const eventMinute = parseMinuteLabel(event.minuteLabel);
  let index = 0;

  history.forEach((point, pointIndex) => {
    if (parseMinuteLabel(point.minuteLabel) <= eventMinute) {
      index = pointIndex;
    }
  });

  return index;
}

export function buildVix(history: ProbabilityPoint[]) {
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

export function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export function interpolatePoint(fromPoint: ProbabilityPoint, toPoint: ProbabilityPoint, progress: number) {
  const eased = easeOutCubic(progress);

  return {
    ...toPoint,
    teamA: fromPoint.teamA + (toPoint.teamA - fromPoint.teamA) * eased,
    teamB: fromPoint.teamB + (toPoint.teamB - fromPoint.teamB) * eased,
    draw: fromPoint.draw + (toPoint.draw - fromPoint.draw) * eased,
  };
}

export function interpolatePointTime(fromPoint: ProbabilityPoint, toPoint: ProbabilityPoint, progress: number) {
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

export function canAnimateLatestPoint(fromHistory: ProbabilityPoint[], toHistory: ProbabilityPoint[]) {
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

export function toSeriesData(animatedHistory: ProbabilityPoint[]) {
  const chartPoints = toChartPoints(animatedHistory);

  return {
    teamA: chartPoints.map(
      ({ point, time }) => ({ time, value: point.teamA }) satisfies LineData,
    ),
    teamB: chartPoints.map(
      ({ point, time }) => ({ time, value: point.teamB }) satisfies LineData,
    ),
    draw: chartPoints.map(
      ({ point, time }) => ({ time, value: point.draw }) satisfies LineData,
    ),
    dominantFill: chartPoints.map(({ point, time }) => toDominantAreaData(point, time)),
  };
}

export function toChartPoints(history: ProbabilityPoint[]) {
  const seenByMinute = new Map<number, number>();
  let previousSecond = -1;

  return history.map((point, index) => {
    const minute = parseMinuteLabel(point.minuteLabel);
    const duplicateOffset = seenByMinute.get(minute) ?? 0;
    seenByMinute.set(minute, duplicateOffset + 1);
    const rawSecond = minute * 60 + duplicateOffset;
    const second = rawSecond > previousSecond ? rawSecond : previousSecond + 1;
    previousSecond = second;

    return {
      point,
      index,
      minute,
      second,
      time: toChartTime(second),
    };
  });
}

function toDominantAreaData(point: ProbabilityPoint, time: Time): AreaData {
  const dominantOutcome = getDominantOutcome(point);
  const colors = getDominantFillColors(dominantOutcome);

  return {
    time,
    value: point[dominantOutcome],
    lineColor: "rgba(0, 0, 0, 0)",
    topColor: colors.top,
    bottomColor: colors.bottom,
  };
}

function getDominantOutcome(point: ProbabilityPoint): "teamA" | "teamB" | "draw" {
  if (point.teamA >= point.teamB && point.teamA >= point.draw) return "teamA";
  if (point.teamB >= point.teamA && point.teamB >= point.draw) return "teamB";
  return "draw";
}

function getDominantFillColors(outcome: "teamA" | "teamB" | "draw") {
  if (outcome === "teamA") {
    return {
      top: "rgba(0, 255, 135, 0.27)",
      bottom: "rgba(0, 255, 135, 0.02)",
    };
  }

  if (outcome === "teamB") {
    return {
      top: "rgba(255, 75, 110, 0.24)",
      bottom: "rgba(255, 75, 110, 0.02)",
    };
  }

  return {
    top: "rgba(154, 167, 178, 0.24)",
    bottom: "rgba(154, 167, 178, 0.02)",
  };
}

export function getVisibleVixPoints(
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

export function logicalIndexToPercent(index: number, visibleLogicalRange: LogicalRange | null, length: number) {
  const range = visibleLogicalRange ?? {
    from: 0,
    to: Math.max(length - 1, 1),
  };
  const rangeSize = Math.max(1, range.to - range.from);
  return ((index - range.from) / rangeSize) * 100;
}
