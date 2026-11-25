import { COMPARABLE_CARD_FIELDS } from "@openrift/shared/catalog-field-compare";
import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import type {
  ReviewCard,
  ReviewCardsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { matchesTextQuery } from "@openrift/shared/search-fold";
import { countNoun, pluralize } from "@openrift/shared/strings";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { CARD_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { CardView } from "@/features/catalog-workspace/lib/workspace-search";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const NEW_CARD_KEY_PREFIX = "new:";

const fetchReviewCards = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ReviewCardsResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).reviewCards(),
  );

export function reviewCardsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.workspaceReview,
    queryFn: () => fetchReviewCards(),
    staleTime: MINUTE_MS,
  });
}

function counted(count: number, noun: string, suffix = ""): string | null {
  return count === 0 ? null : `${countNoun(count, noun)}${suffix}`;
}

function differ(count: number): string {
  return ` ${pluralize(count, "differs", "differ")}`;
}

function cardFieldsText(fields: readonly string[]): string | null {
  if (fields.length === 0) {
    return null;
  }
  const labels = fields.map((field) => {
    const known = COMPARABLE_CARD_FIELDS.find((entry) => entry === field);
    return known === undefined ? field : CARD_FIELD_LABELS[known];
  });
  return `${labels.join(", ")}${differ(fields.length)}`;
}

function hasImageWork(card: ReviewCard): boolean {
  return card.pending.newImages + card.pending.failedImages > 0;
}

function hasDataWork(card: ReviewCard): boolean {
  const { pending } = card;
  const data =
    pending.cardFields.length + pending.newPrintings + pending.faces + pending.printings > 0;
  return data || !hasImageWork(card);
}

export function selectReviewQueue(
  cards: readonly ReviewCard[],
  view: "review" | "images" | undefined,
): ReviewCard[] {
  if (view === "review") {
    return cards.filter((card) => hasDataWork(card));
  }
  if (view === "images") {
    return cards.filter((card) => hasImageWork(card));
  }
  return [...cards];
}

export interface ReviewStep {
  key: string;
  cardSlug: string | null;
}

export function reviewSteps(
  view: CardView | undefined,
  lists: {
    reviewCards: readonly ReviewCard[];
    listingCards?: readonly { cardSlug: string }[];
    readyRows?: readonly { cardSlug: string | null; reviewKey: string | null }[];
  },
): ReviewStep[] {
  if (view === "listings") {
    return (lists.listingCards ?? []).map((card) => ({
      key: card.cardSlug,
      cardSlug: card.cardSlug,
    }));
  }
  if (view === "ready") {
    const steps = (lists.readyRows ?? []).flatMap((row) => {
      const key = row.cardSlug ?? row.reviewKey;
      return key === null ? [] : [{ key, cardSlug: row.cardSlug }];
    });
    return [...new Map(steps.map((step) => [step.key, step])).values()];
  }
  return selectReviewQueue(lists.reviewCards, view);
}

export function reviewNeighbor<T extends { key: string }>(
  steps: readonly T[],
  key: string,
  delta: 1 | -1,
  lastIndex: number,
  skipKey?: string,
): T | null {
  const index = steps.findIndex((step) => step.key === key);
  let targetIndex: number;
  if (index !== -1) {
    targetIndex = index + delta;
  } else if (lastIndex === -1) {
    targetIndex = delta === 1 ? 0 : -1;
  } else {
    targetIndex = delta === 1 ? lastIndex : lastIndex - 1;
  }
  if (skipKey !== undefined && steps[targetIndex]?.key === skipKey) {
    targetIndex += delta;
  }
  return targetIndex < 0 ? null : (steps[targetIndex] ?? null);
}

export function summaryReviewKey(row: { cardSlug: string | null; normalizedName: string }): string {
  return row.cardSlug ?? `${NEW_CARD_KEY_PREFIX}${row.normalizedName}`;
}

const byKeyCache = new WeakMap<readonly ReviewCard[], ReadonlyMap<string, ReviewCard>>();

export function reviewCardsByKey(cards: readonly ReviewCard[]): ReadonlyMap<string, ReviewCard> {
  let byKey = byKeyCache.get(cards);
  if (byKey === undefined) {
    byKey = new Map(cards.map((card) => [card.key, card]));
    byKeyCache.set(cards, byKey);
  }
  return byKey;
}

export function pendingCount(card: ReviewCard): number {
  const { pending } = card;
  return (
    pending.cardFields.length +
    pending.newPrintings +
    pending.faces +
    pending.printings +
    pending.newImages +
    pending.failedImages
  );
}

export function pendingSummary(card: ReviewCard): string {
  const { pending } = card;
  const parts = [
    card.cardSlug === null ? "New card" : null,
    cardFieldsText(pending.cardFields),
    counted(pending.newPrintings, "new printing"),
    counted(pending.faces, "face", differ(pending.faces)),
    counted(pending.printings, "printing", differ(pending.printings)),
    counted(pending.newImages, "new image"),
    counted(pending.failedImages, "image", " failed to rehost"),
  ].filter((part) => part !== null);
  return parts.join(" · ");
}

export function providerName(provider: string): string {
  return provider === USER_SUBMISSION_PROVIDER ? "Contributor" : provider;
}

export function reviewSources(card: ReviewCard): string {
  return card.providers.map((provider) => providerName(provider)).join(", ");
}

export function selectReviewCards(cards: readonly ReviewCard[], query: string): ReviewCard[] {
  return cards.filter((card) => matchesTextQuery(query, [card.cardName, reviewSources(card)]));
}
