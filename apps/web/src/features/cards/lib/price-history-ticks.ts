import { dateLeafPartsUtc } from "@openrift/shared/format-date";

import { DATE_WORDS } from "@/lib/date-words";

export function formatTickDate(date: string): string {
  const { month, day } = dateLeafPartsUtc(date, DATE_WORDS);
  return month === "" ? "" : `${month} ${day}`;
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
