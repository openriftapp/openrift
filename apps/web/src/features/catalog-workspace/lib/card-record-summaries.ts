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

export function historySummary(
  events: readonly { createdAt: string }[],
  now?: Date,
): string | undefined {
  const newest = events
    .map((event) => event.createdAt)
    .toSorted()
    .at(-1);
  return newest === undefined ? undefined : `Updated ${formatRelativeTime(newest, { now })}`;
}
