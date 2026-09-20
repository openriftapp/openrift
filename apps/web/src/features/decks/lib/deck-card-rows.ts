import type { DeckCardResponse, DeckCardWithDeckResponse } from "@openrift/shared/types/api/deck";

export function toDeckCard(row: DeckCardWithDeckResponse): DeckCardResponse {
  return {
    cardId: row.cardId,
    zone: row.zone,
    quantity: row.quantity,
    preferredPrintingId: row.preferredPrintingId,
  };
}

export function deckCardsForDeck(
  rows: readonly DeckCardWithDeckResponse[] | undefined,
  deckId: string,
): DeckCardResponse[] {
  return (rows ?? []).filter((row) => row.deckId === deckId).map((row) => toDeckCard(row));
}

/**
 * Every touched deck is replaced wholesale: one emptied since the watermark
 * contributes no rows of its own, so only its id says to drop what it had.
 */
export function mergeDeckCardsDelta(
  previous: readonly DeckCardWithDeckResponse[],
  changed: readonly DeckCardWithDeckResponse[],
  touchedDeckIds: readonly string[],
): DeckCardWithDeckResponse[] {
  const touched = new Set(touchedDeckIds);
  for (const row of changed) {
    touched.add(row.deckId);
  }
  return [...previous.filter((row) => !touched.has(row.deckId)), ...changed];
}

export function dropCardsOfMissingDecks(
  rows: readonly DeckCardWithDeckResponse[],
  liveDeckIds: ReadonlySet<string>,
): DeckCardWithDeckResponse[] {
  return rows.filter((row) => liveDeckIds.has(row.deckId));
}

export function deckCardsByDeck(
  rows: readonly DeckCardWithDeckResponse[] | undefined,
  deckIds: Iterable<string>,
): Record<string, DeckCardResponse[]> {
  const wanted = new Set(deckIds);
  const byDeck: Record<string, DeckCardResponse[]> = {};
  for (const id of wanted) {
    byDeck[id] = [];
  }
  for (const row of rows ?? []) {
    byDeck[row.deckId]?.push(toDeckCard(row));
  }
  return byDeck;
}
