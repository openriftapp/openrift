import type { Printing } from "@openrift/shared/types/catalog";

import { useCardSearchIndex } from "@/features/cards/hooks/use-search-index";
import type { ResolvedCard } from "@/features/decks/lib/deck-import-matcher";

/** One searchable {@link ResolvedCard} per card, with each card's first printing standing in for it. */
export function useResolvedCardIndex(allPrintings: Printing[]) {
  const { rows: searchRows, codesByRowId } = useCardSearchIndex(allPrintings);
  const rows = searchRows.map((row) => ({
    ...row,
    card: {
      cardId: row.printing.cardId,
      cardName: row.name,
      cardType: row.printing.card.type,
      cardTypes: row.printing.card.types,
      superTypes: row.printing.card.superTypes,
      domains: row.printing.card.domains,
      shortCode: row.printing.shortCode,
      preferredPrintingId: null,
    } satisfies ResolvedCard,
  }));
  return { rows, codesByCardId: codesByRowId };
}
