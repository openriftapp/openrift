import { formatRelativeTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";

export function bansErrataSummary(banCount: number | undefined, hasErrata: boolean) {
  if (banCount === undefined) {
    return hasErrata ? "Errata" : undefined;
  }
  const parts = [
    ...(banCount > 0 ? [`${banCount} ${pluralize(banCount, "ban")}`] : []),
    ...(hasErrata ? ["errata"] : []),
  ];
  const text = parts.join(", ");
  return text.length === 0 ? "None" : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

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
