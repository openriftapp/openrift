import { priceTotal } from "@openrift/shared/card-price";
import type { Printing } from "@openrift/shared/types/catalog";

export interface ScanSummaryRow {
  printing: Printing;
  count: number;
}

export interface ScanSessionSummaryData {
  cards: number;
  totalValue: number;
  unpricedCards: number;
  wishedCards: number;
  newCards: number | null;
}

interface ScanSummaryDeps {
  priceOf: (printingId: string) => number | undefined;
  isWished: (printing: Printing) => boolean;
  ownedOfCard: ((cardId: string) => number) | null;
}

export function computeScanSessionSummary(
  rows: readonly ScanSummaryRow[],
  deps: ScanSummaryDeps,
): ScanSessionSummaryData {
  const counted = rows.filter((row) => row.count > 0);
  const value = priceTotal(
    counted.map((row) => ({ price: deps.priceOf(row.printing.printingId), quantity: row.count })),
  );
  let cards = 0;
  let wishedCards = 0;
  let newCards = 0;
  for (const row of counted) {
    cards += row.count;
    if (deps.isWished(row.printing)) {
      wishedCards += row.count;
    }
    if (deps.ownedOfCard !== null && deps.ownedOfCard(row.printing.cardId) === 0) {
      newCards += row.count;
    }
  }

  return {
    cards,
    totalValue: value.value,
    unpricedCards: value.unpriced,
    wishedCards,
    newCards: deps.ownedOfCard === null ? null : newCards,
  };
}
