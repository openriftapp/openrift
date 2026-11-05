import { formatShortDay, formatShortDayYear } from "@openrift/shared/format-date";

import { DATE_WORDS } from "@/lib/date-words";

// The label sits above the dot until the dot climbs into the top band the range toggle covers.
const LABEL_FLIP_RATIO = 0.85;

export function spansYears(points: readonly { date: string }[]): boolean {
  const first = points.at(0)?.date.slice(0, 4);
  const last = points.at(-1)?.date.slice(0, 4);
  return first !== undefined && last !== undefined && first !== last;
}

export function formatTickDate(date: string, withYear = false): string {
  return withYear ? formatShortDayYear(date, DATE_WORDS) : formatShortDay(date, DATE_WORDS);
}

export function tickAnchor(index: number, count: number): "start" | "middle" | "end" {
  if (count > 1 && index === count - 1) {
    return "end";
  }
  return index === 0 ? "start" : "middle";
}

export function lastValuePoint<T extends { value: number | null }>(
  points: readonly T[],
): T | undefined {
  return points.findLast((point) => point.value !== null);
}

export function lastValueLabelPosition(
  points: readonly { value: number | null; low: number | null }[],
  lastValue: number,
): "top" | "bottom" {
  const high = Math.max(...points.flatMap((point) => [point.value ?? 0, point.low ?? 0]));
  return high > 0 && lastValue / high >= LABEL_FLIP_RATIO ? "bottom" : "top";
}
