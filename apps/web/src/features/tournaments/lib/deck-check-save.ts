import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";

import type { ImportedDeckCard, ImportOverflow } from "@/features/decks/lib/deck-import-cards";
import { mergeMatchedEntries } from "@/features/decks/lib/deck-import-cards";

/** Only catalog-matched lines carry over; ambiguous and unmatched lines are counted as skipped. */
export function deckCardsFromCheckEntry(cards: readonly DeckCheckEntryCardResponse[]): {
  cards: ImportedDeckCard[];
  skippedCount: number;
  overflow: ImportOverflow[];
} {
  const skippedCount = cards.filter(
    (card) => card.matchStatus !== "matched" || card.resolvedCardId === null,
  ).length;
  const { cards: deckCards, overflow } = mergeMatchedEntries(
    cards.map((card) => ({
      zone: card.zone,
      entry: { quantity: card.quantity },
      resolvedCard:
        card.matchStatus === "matched" && card.resolvedCardId !== null
          ? {
              cardId: card.resolvedCardId,
              displayName: card.rawName,
              preferredPrintingId: card.resolvedPrintingId,
            }
          : null,
    })),
  );
  return { cards: deckCards, skippedCount, overflow };
}
