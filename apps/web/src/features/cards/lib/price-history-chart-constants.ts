import { DAY_MS } from "@openrift/shared/format-date";
import type { TimeRange } from "@openrift/shared/types/pricing";

import { m } from "@/paraglide/messages.js";

export const TIME_RANGES = [
  { value: "7d", label: "7D", days: 7 },
  { value: "30d", label: "30D", days: 30 },
  { value: "90d", label: "90D", days: 90 },
  { value: "all", label: "All", days: 0 },
] as const satisfies readonly { value: TimeRange; label: string; days: number }[];

type TimeRangeOption = (typeof TIME_RANGES)[number];

export function timeRangeLabel(range: TimeRangeOption): string {
  return range.value === "all" ? m.common_all() : range.label;
}

export function snapshotSpanDays(snapshots?: readonly { date: string }[]): number | null {
  const first = snapshots?.[0];
  const last = snapshots?.at(-1);
  if (!snapshots || snapshots.length < 2 || !first || !last) {
    return null;
  }
  return Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / DAY_MS);
}

export function availableTimeRanges(
  spanDays: number | null,
  allowed?: readonly TimeRange[],
): TimeRangeOption[] {
  return TIME_RANGES.filter(
    (range) =>
      (allowed === undefined || allowed.includes(range.value)) &&
      (range.days === 0 || spanDays === null || spanDays >= range.days),
  );
}

export function effectiveTimeRange(
  range: TimeRange,
  available: readonly TimeRangeOption[],
): TimeRange {
  return available.some((option) => option.value === range) ? range : "all";
}
