const DECK_CARDS_PAGE_DEFAULT = 10_000;
const DECK_CARDS_PAGE_MAX = 10_000;

export function clampDeckCardsLimit(limit?: number): number {
  return Math.min(limit ?? DECK_CARDS_PAGE_DEFAULT, DECK_CARDS_PAGE_MAX);
}

export interface DeckCardsCursor {
  safeXid: string;
  id: string;
}

export function buildDeckCardsCursor(cursor: DeckCardsCursor): string {
  return `${cursor.safeXid}_${cursor.id}`;
}

/** The contract's regex has already rejected any other shape. */
export function parseDeckCardsCursor(cursor: string): DeckCardsCursor {
  const separator = cursor.indexOf("_");
  return { safeXid: cursor.slice(0, separator), id: cursor.slice(separator + 1) };
}
