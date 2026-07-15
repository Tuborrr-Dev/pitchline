import type { AreaData, LineData, LogicalRange, Time } from "lightweight-charts";

import type { MatchEvent, ProbabilityPoint } from "@/lib/types";

export function toTime(timestamp: string): Time {
  return Math.floor(new Date(timestamp).getTime() / 1000) as Time;
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
  return Number.parseInt(minuteLabel.replace(/\D/g, ""), 10) || 0;
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
