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
  const labels = fields.map(
    (field) => (CARD_FIELD_LABELS as Partial<Record<string, string>>)[field] ?? field,
  );
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

/** The cards Skip walks: one segment, or every card with work when no segment is open. */
export function selectReviewQueue(
  cards: readonly ReviewCard[],
  view: CardView | undefined,
): ReviewCard[] {
  if (view === "review") {
    return cards.filter((card) => hasDataWork(card));
  }
  if (view === "images") {
    return cards.filter((card) => hasImageWork(card));
  }
  return [...cards];
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
