import { sideKey } from "@openrift/shared/printing-side";

/**
 * Card detail keys for a deck's cards: a card on side 2 of its printing opens that side.
 * `printings` is the deck payload's catalog subset.
 */
export function deckCardDetailKeys(
  printings: readonly { printingId: string; side: 1 | 2; cardId: string }[],
): (card: { cardId: string; printingId: string | null }) => string | null {
  const keyByCard = new Map(
    printings.map((printing) => [`${printing.printingId}|${printing.cardId}`, sideKey(printing)]),
  );
  function detailKey(card: { cardId: string; printingId: string | null }): string | null {
    if (card.printingId === null) {
      return null;
    }
    return keyByCard.get(`${card.printingId}|${card.cardId}`) ?? card.printingId;
  }
  return detailKey;
}
