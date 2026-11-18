import type { DeckCardResponse } from "./types/api/deck.js";

/** The most copies one deck card row holds; the contract rejects more and merged sums stop here. */
export const MAX_DECK_CARD_QUANTITY = 99;

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

export function deckCardKey(card: {
  cardId: string;
  zone: string;
  preferredPrintingId: string | null;
}): string {
  return `${card.cardId}|${card.zone}|${card.preferredPrintingId ?? ""}`;
}

/**
 * Folds repeated lines into one row per `uq_deck_cards` key, summing quantity up to
 * `MAX_DECK_CARD_QUANTITY`. The index is `NULLS NOT DISTINCT`, so a null
 * `preferred_printing_id` does not separate two lines the way a null usually would.
 */
export function mergeDeckCards<T extends DeckCardLine>(cards: readonly T[]): T[] {
  const merged = new Map<string, T>();
  for (const card of cards) {
    const key = deckCardKey(card);
    const held = merged.get(key);
    if (held === undefined) {
      merged.set(key, { ...card, quantity: Math.min(MAX_DECK_CARD_QUANTITY, card.quantity) });
      continue;
    }
    held.quantity = Math.min(MAX_DECK_CARD_QUANTITY, held.quantity + card.quantity);
  }
  return [...merged.values()];
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
