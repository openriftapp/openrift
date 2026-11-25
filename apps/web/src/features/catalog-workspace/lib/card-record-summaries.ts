import { formatRelativeTime } from "@openrift/shared/format-date";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";

export function newestFirst<T extends { createdAt: string }>(events: readonly T[]): T[] {
  return events.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function historySummary(
  events: readonly { createdAt: string; label?: string }[],
  now?: Date,
): string | undefined {
  const newest = newestFirst(events).at(0);
  return newest === undefined
    ? undefined
    : `${newest.label ?? "Updated"} ${formatRelativeTime(newest.createdAt, { now })}`;
}

export function cardPrintingCount(
  row: Pick<CandidateCardSummaryResponse, "cardSlug" | "shortCodes" | "stagingShortCodes">,
): number {
  return row.cardSlug === null ? row.stagingShortCodes.length : row.shortCodes.length;
}
