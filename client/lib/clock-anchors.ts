import type { ClockAnchor } from "@/schemas/pitchline";

export function sortClockAnchors(anchors: readonly ClockAnchor[]) {
  return [...anchors].sort(
    (left, right) => new Date(left.utc_start).getTime() - new Date(right.utc_start).getTime(),
  );
}

export function upsertClockAnchor(
  anchors: readonly ClockAnchor[],
  anchor: ClockAnchor,
) {
  const nextAnchors = new Map<string, ClockAnchor>();

  anchors.forEach((item) => {
    nextAnchors.set(clockAnchorKey(item), item);
  });
  nextAnchors.set(clockAnchorKey(anchor), anchor);

  return sortClockAnchors([...nextAnchors.values()]);
}

export function mergeClockAnchors(
  current: readonly ClockAnchor[],
  incoming: readonly ClockAnchor[],
) {
  return incoming.reduce(upsertClockAnchor, [...current]);
}

export function toMatchMinute(timestamp: string, anchors: readonly ClockAnchor[]) {
  const timestampMs = new Date(timestamp).getTime();
  if (Number.isNaN(timestampMs)) return null;

  const active = sortClockAnchors(anchors)
    .reverse()
    .find((anchor) => {
      const anchorMs = new Date(anchor.utc_start).getTime();
      return !Number.isNaN(anchorMs) && anchorMs <= timestampMs;
    });

  if (!active) return null;
  if (!active.running) return active.minute_start;

  const anchorMs = new Date(active.utc_start).getTime();
  const elapsedSeconds = (timestampMs - anchorMs) / 1000;
  return active.minute_start + elapsedSeconds / 60;
}

export function formatMatchMinuteLabel(matchMinute: number) {
  return `${Math.max(0, Math.round(matchMinute))}'`;
}

function clockAnchorKey(anchor: ClockAnchor) {
  return `${anchor.phase}:${anchor.status_id}:${anchor.utc_start}`;
}
