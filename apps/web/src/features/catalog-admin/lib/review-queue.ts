import { matchesCardQuery } from "@openrift/shared/card-search";
import type {
  ReviewQueueItem,
  ReviewQueueKind,
} from "@openrift/shared/contracts/admin/catalog-review";

export type ReviewFilter = "all" | "contributors" | "sources";

export const REVIEW_FILTERS: readonly ReviewFilter[] = ["all", "contributors", "sources"];

export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "All",
  contributors: "Contributors",
  sources: "Other sources",
};

export const REVIEW_KIND_ORDER: readonly ReviewQueueKind[] = [
  "correction",
  "new_card",
  "image",
  "source",
];

export const REVIEW_KIND_LABELS: Record<ReviewQueueKind, string> = {
  correction: "Correction",
  new_card: "New card",
  image: "Image",
  source: "Source",
};

export type ReviewKindTone = "warning" | "violet" | "info" | "muted";

export const REVIEW_KIND_TONES: Record<ReviewQueueKind, ReviewKindTone> = {
  correction: "warning",
  new_card: "violet",
  image: "info",
  source: "muted",
};

export const REVIEW_KIND_PLURALS: Record<ReviewQueueKind, string> = {
  correction: "Corrections",
  new_card: "New cards",
  image: "Images",
  source: "Sources",
};

export function matchesReviewFilter(item: ReviewQueueItem, filter: ReviewFilter): boolean {
  if (filter === "contributors") {
    return item.isContributor;
  }
  if (filter === "sources") {
    return !item.isContributor;
  }
  return true;
}

export function selectReviewItems(
  items: readonly ReviewQueueItem[],
  filter: ReviewFilter,
  query: string,
): ReviewQueueItem[] {
  return items
    .filter(
      (item) =>
        matchesReviewFilter(item, filter) &&
        matchesCardQuery(query, [item.cardName, item.provider, item.submitterName]),
    )
    .toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function countReviewKinds(
  items: readonly ReviewQueueItem[],
): Record<ReviewQueueKind, number> {
  const counts: Record<ReviewQueueKind, number> = {
    correction: 0,
    new_card: 0,
    image: 0,
    source: 0,
  };
  for (const item of items) {
    counts[item.kind] += 1;
  }
  return counts;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function oldestItemAgeDays(
  items: readonly ReviewQueueItem[],
  now: Date = new Date(),
): number | null {
  let oldest: number | null = null;
  for (const item of items) {
    const at = Date.parse(item.createdAt);
    if (Number.isNaN(at)) {
      continue;
    }
    if (oldest === null || at < oldest) {
      oldest = at;
    }
  }
  if (oldest === null) {
    return null;
  }
  return Math.max(0, Math.floor((now.getTime() - oldest) / DAY_MS));
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function summarizeReviewItem(item: ReviewQueueItem): string {
  const parts: string[] = [];
  if (item.changedFields > 0) {
    parts.push(plural(item.changedFields, "field"));
  }
  if (item.newPrintings > 0) {
    parts.push(`${plural(item.newPrintings, "new printing")}`);
  }
  if (item.uncheckedPrintings > 0) {
    parts.push(plural(item.uncheckedPrintings, "unchecked printing"));
  }
  if (parts.length === 0) {
    return "Nothing to apply";
  }
  return parts.join(" · ");
}

export type ReviewItemTarget = { kind: "card"; cardSlug: string } | { kind: "draft"; name: string };

export function reviewItemTarget(item: ReviewQueueItem): ReviewItemTarget {
  if (item.cardSlug) {
    return { kind: "card", cardSlug: item.cardSlug };
  }
  return { kind: "draft", name: item.normName || item.cardName };
}

export function reviewNeighbours(
  items: readonly ReviewQueueItem[],
  cardSlug: string,
): { prev: ReviewQueueItem | null; next: ReviewQueueItem | null } {
  const index = items.findIndex((item) => item.cardSlug === cardSlug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return { prev: items[index - 1] ?? null, next: items[index + 1] ?? null };
}
