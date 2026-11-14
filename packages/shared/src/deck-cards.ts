import type { DeckCardResponse } from "./types/api/deck.js";

interface DeckCardLine {
  cardId: string;
  zone: string;
  quantity: number;
  preferredPrintingId: string | null;
}

export function toDeckCard(row: DeckCardResponse): DeckCardResponse {
  return {
    cardId: row.cardId,
    zone: row.zone,
    quantity: row.quantity,
    preferredPrintingId: row.preferredPrintingId,
  };
}

function lineKey(card: DeckCardLine): string {
  return `${card.cardId} ${card.zone} ${card.quantity} ${card.preferredPrintingId ?? ""}`;
}

/** Lines compare as given: repeated lines of one card are not summed first. */
export function sameDeckCards(a: readonly DeckCardLine[], b: readonly DeckCardLine[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const held = new Map<string, number>();
  for (const card of a) {
    const key = lineKey(card);
    held.set(key, (held.get(key) ?? 0) + 1);
  }
  for (const card of b) {
    const key = lineKey(card);
    const left = held.get(key) ?? 0;
    if (left === 0) {
      return false;
    }
    held.set(key, left - 1);
  }
  return true;
}
