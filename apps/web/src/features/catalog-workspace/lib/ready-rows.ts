import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import type {
  WorkspaceTrustedCardsPreview,
  WorkspaceTrustedPrintingsPreview,
} from "@openrift/shared/contracts/admin/catalog-workspace-batch";
import { matchesTextQuery } from "@openrift/shared/search-fold";

import { providerName } from "@/features/catalog-workspace/lib/review-cards";

export interface ReadyRow {
  key: string;
  kind: "card" | "printing";
  batchKey: string;
  cardName: string;
  cardSlug: string | null;
  reviewKey: string | null;
  creates: string;
  sources: string;
  refusal: string | null;
}

function sourcesText(providers: readonly string[]): string {
  return providers.map((provider) => providerName(provider)).join(", ");
}

/** One row per card or printing a trusted source would create, the refused ones last. */
export function buildReadyRows(
  reviewCards: readonly ReviewCard[],
  cards: WorkspaceTrustedCardsPreview,
  printings: WorkspaceTrustedPrintingsPreview,
): ReadyRow[] {
  const newCardByName = new Map(
    reviewCards.filter((card) => card.cardSlug === null).map((card) => [card.cardName, card]),
  );
  const cardBySlug = new Map(
    reviewCards.flatMap((card) => (card.cardSlug === null ? [] : [[card.cardSlug, card] as const])),
  );
  const cardRow = (name: string, refusal: string | null): ReadyRow => {
    const reviewCard = newCardByName.get(name);
    return {
      key: `card:${name}`,
      kind: "card",
      batchKey: name,
      cardName: name,
      cardSlug: null,
      reviewKey: reviewCard?.key ?? null,
      creates: "New card",
      sources: sourcesText(reviewCard?.providers ?? []),
      refusal,
    };
  };
  const printingRow = (
    item: WorkspaceTrustedPrintingsPreview["items"][number],
    refusal: string | null,
  ): ReadyRow => ({
    key: `printing:${item.candidatePrintingId}`,
    kind: "printing",
    batchKey: item.candidatePrintingId,
    cardName: cardBySlug.get(item.cardSlug)?.cardName ?? item.cardSlug,
    cardSlug: item.cardSlug,
    reviewKey: null,
    creates: item.label,
    sources: sourcesText(item.providers),
    refusal,
  });
  return [
    ...cards.names.map((name) => cardRow(name, null)),
    ...printings.items.map((item) => printingRow(item, null)),
    ...cards.ineligible.map((entry) => cardRow(entry.name, entry.reason)),
    ...printings.ineligible.map((entry) => printingRow(entry, entry.reason)),
  ];
}

export function selectReadyRows(rows: readonly ReadyRow[], query: string): ReadyRow[] {
  return rows.filter((row) => matchesTextQuery(query, [row.cardName, row.creates, row.sources]));
}

export function readyBatchKeys(rows: readonly ReadyRow[]): {
  cards: string[];
  printings: string[];
} {
  const ready = rows.filter((row) => row.refusal === null);
  return {
    cards: ready.filter((row) => row.kind === "card").map((row) => row.batchKey),
    printings: ready.filter((row) => row.kind === "printing").map((row) => row.batchKey),
  };
}
