import type { ListKind } from "@openrift/shared/types/api/list";

import type { CardOwnership } from "@/features/decks/lib/deck-ownership-types";
import type { InitialEntry } from "@/features/lists/lib/list-initial-entry";
import type { HandoffItem } from "@/lib/marketplace-handoff";

export function missingCardsToHandoffItems(cards: readonly CardOwnership[]): HandoffItem[] {
  return cards
    .filter((card) => card.shortfall > 0)
    .map((card) => {
      const printing = card.cheapestPrinting ?? card.displayPrinting;
      return {
        printingId: printing?.id,
        quantity: card.shortfall,
        name: card.displayName,
        language: printing?.language,
      };
    });
}

export function missingCardsToListEntries(
  cards: readonly CardOwnership[],
  kind: ListKind,
): InitialEntry[] {
  const missing = cards.filter((card) => card.shortfall > 0);
  if (kind === "card") {
    return missing.map((card) => ({ cardId: card.cardId, quantity: card.shortfall }));
  }
  if (kind === "printing") {
    return missing.flatMap((card) => {
      const printing = card.cheapestPrinting ?? card.displayPrinting;
      return printing ? [{ printingId: printing.id, quantity: card.shortfall }] : [];
    });
  }
  return [];
}
