import { matchesCardQuery } from "@openrift/shared/card-search";
import type { CatalogCardRow } from "@openrift/shared/contracts/admin/catalog-review";

import type { PriceAssignBucket } from "@/features/cards/lib/marketplace-coverage";
import {
  ALL_ASSIGNABLE_SCOPE,
  bucketScopeKey,
  bucketsMatchScope,
} from "@/features/cards/lib/marketplace-coverage";

export const CARD_SEGMENTS = ["all", "attention", "drafts"] as const;

export type CardSegment = (typeof CARD_SEGMENTS)[number];

export const CARD_SEGMENT_LABELS: Record<CardSegment, string> = {
  all: "All",
  attention: "Needs attention",
  drafts: "Drafts",
};

export const CARD_ISSUES = [
  "proposals",
  "new-printings",
  "unlinked-products",
  "no-image",
  "unchecked-source",
] as const;

export type CardIssue = (typeof CARD_ISSUES)[number];

export const CARD_ISSUE_LABELS: Record<CardIssue, string> = {
  proposals: "Proposals",
  "new-printings": "New printings",
  "unlinked-products": "Unlinked products",
  "no-image": "No image",
  "unchecked-source": "Unchecked trusted source",
};

export const ANY_ISSUE = "any";

export interface CardsListSearch {
  from: "cards";
  segment?: CardSegment;
  issue?: CardIssue;
  scope?: string;
  set?: string;
  q?: string;
}

export interface CardsListSearchInput {
  segment?: CardSegment;
  issue?: CardIssue;
  scope?: string;
  set?: string;
  q?: string;
}

export interface CardsListParams {
  segment: CardSegment;
  issue?: CardIssue;
  scope: string;
  set?: string;
  q?: string;
}

export function visibleIssues(canSeeUnlinkedProducts: boolean): readonly CardIssue[] {
  if (canSeeUnlinkedProducts) {
    return CARD_ISSUES;
  }
  return CARD_ISSUES.filter((issue) => issue !== "unlinked-products");
}

export function cardsListParams(
  search: CardsListSearchInput,
  canSeeUnlinkedProducts: boolean,
): CardsListParams {
  const issue =
    search.issue === "unlinked-products" && !canSeeUnlinkedProducts ? undefined : search.issue;
  return {
    segment: search.segment ?? "all",
    issue,
    scope:
      issue === "unlinked-products" ? (search.scope ?? ALL_ASSIGNABLE_SCOPE) : ALL_ASSIGNABLE_SCOPE,
    set: search.set,
    q: search.q,
  };
}

export function cardsListSearch(params: CardsListParams): CardsListSearch {
  return {
    from: "cards",
    segment: params.segment === "all" ? undefined : params.segment,
    issue: params.issue,
    scope: params.scope === ALL_ASSIGNABLE_SCOPE ? undefined : params.scope,
    set: params.set,
    q: params.q,
  };
}

export type BucketLookup = (cardSlug: string | null) => PriceAssignBucket[] | undefined;

export function catalogCardKey(row: Pick<CatalogCardRow, "cardSlug" | "normName">): string {
  return row.cardSlug ?? `draft:${row.normName}`;
}

export function matchesCardSegment(row: CatalogCardRow, segment: CardSegment): boolean {
  if (segment === "attention") {
    return row.needsAttention;
  }
  if (segment === "drafts") {
    return row.cardSlug === null;
  }
  return true;
}

export function unlinkedProductCount(
  buckets: PriceAssignBucket[] | undefined,
  scope: string,
): number {
  if (!buckets) {
    return 0;
  }
  let total = 0;
  for (const bucket of buckets) {
    const inScope =
      scope === ALL_ASSIGNABLE_SCOPE ? bucket.assignable : bucketScopeKey(bucket) === scope;
    if (inScope) {
      total += bucket.unbound;
    }
  }
  return total;
}

export interface CatalogCardFilter extends Omit<CardsListParams, "scope"> {
  scope?: string;
  buckets?: BucketLookup;
}

/** A missing `buckets` lookup means the marketplace corpus has not loaded; the unlinked-products rule stands down. */
export function matchesCardIssue(
  row: CatalogCardRow,
  issue: CardIssue,
  scope: string,
  buckets?: BucketLookup,
): boolean {
  switch (issue) {
    case "proposals": {
      return row.proposals > 0;
    }
    case "new-printings": {
      return row.newPrintings > 0;
    }
    case "no-image": {
      return row.printingsWithoutImage > 0;
    }
    case "unchecked-source": {
      return row.uncheckedTrustedProviders.length > 0;
    }
    case "unlinked-products": {
      return buckets === undefined ? true : bucketsMatchScope(buckets(row.cardSlug), scope);
    }
    default: {
      return true;
    }
  }
}

export function selectCatalogCards(
  rows: readonly CatalogCardRow[],
  filter: CatalogCardFilter,
): CatalogCardRow[] {
  const query = filter.q ?? "";
  return rows
    .filter(
      (row) =>
        matchesCardSegment(row, filter.segment) &&
        (filter.issue === undefined ||
          matchesCardIssue(
            row,
            filter.issue,
            filter.scope ?? ALL_ASSIGNABLE_SCOPE,
            filter.buckets,
          )) &&
        (filter.set === undefined || row.setSlugs.includes(filter.set)) &&
        matchesCardQuery(query, [row.name, ...row.shortCodes]),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name, "en"));
}

export function segmentCounts(
  rows: readonly CatalogCardRow[],
  scoped: Pick<CardsListParams, "set" | "q">,
): Record<CardSegment, number> {
  const counts: Record<CardSegment, number> = { all: 0, attention: 0, drafts: 0 };
  const query = scoped.q ?? "";
  for (const row of rows) {
    if (scoped.set !== undefined && !row.setSlugs.includes(scoped.set)) {
      continue;
    }
    if (!matchesCardQuery(query, [row.name, ...row.shortCodes])) {
      continue;
    }
    counts.all += 1;
    if (row.needsAttention) {
      counts.attention += 1;
    }
    if (row.cardSlug === null) {
      counts.drafts += 1;
    }
  }
  return counts;
}

export interface CatalogCardNeighbours {
  prev: CatalogCardRow | null;
  next: CatalogCardRow | null;
}

export function catalogCardNeighbours(
  rows: readonly CatalogCardRow[],
  key: string,
): CatalogCardNeighbours {
  const index = rows.findIndex((row) => catalogCardKey(row) === key);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return { prev: rows[index - 1] ?? null, next: rows[index + 1] ?? null };
}

export type AttentionTone = "warning" | "violet" | "info" | "destructive" | "muted";

export interface AttentionBadge {
  key: string;
  label: string;
  tone: AttentionTone;
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

export function cardAttentionBadges(row: CatalogCardRow, unlinked = 0): AttentionBadge[] {
  const badges: AttentionBadge[] = [];
  if (row.proposals > 0) {
    badges.push({ key: "proposals", label: plural(row.proposals, "proposal"), tone: "warning" });
  }
  if (row.newPrintings > 0) {
    badges.push({
      key: "new-printings",
      label: plural(row.newPrintings, "new printing"),
      tone: "violet",
    });
  }
  if (row.uncheckedTrustedProviders.length > 0) {
    badges.push({
      key: "unchecked-source",
      label: `unchecked: ${row.uncheckedTrustedProviders.join(", ")}`,
      tone: "info",
    });
  }
  if (row.printingsWithoutImage > 0) {
    badges.push({ key: "no-image", label: "no image", tone: "destructive" });
  }
  if (unlinked > 0) {
    badges.push({
      key: "unlinked-products",
      label: `${plural(unlinked, "product")} unlinked`,
      tone: "muted",
    });
  }
  return badges;
}

export interface ScopeOption {
  value: string;
  label: string;
  count: number;
}

function scopeOrder(key: string): string {
  if (key.startsWith("cardmarket")) {
    return `0:${key}`;
  }
  if (key.startsWith("tcgplayer")) {
    return `1:${key}`;
  }
  return `2:${key}`;
}

export function scopeCardCounts(
  rows: readonly CatalogCardRow[],
  buckets: BucketLookup,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rowBuckets = buckets(row.cardSlug);
    if (!rowBuckets) {
      continue;
    }
    const seen = new Set<string>();
    for (const bucket of rowBuckets) {
      if (bucket.unbound === 0) {
        continue;
      }
      const key = bucketScopeKey(bucket);
      if (!seen.has(key)) {
        seen.add(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export function scopeKeysInOrder(counts: Map<string, number>): string[] {
  return [...counts.keys()].toSorted((a, b) => scopeOrder(a).localeCompare(scopeOrder(b), "en"));
}
