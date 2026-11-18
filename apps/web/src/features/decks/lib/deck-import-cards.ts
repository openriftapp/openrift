import { legendDisplayName } from "@openrift/shared/card-name";
import { MAX_DECK_CARD_QUANTITY, mergeDeckCardsWithOverflow } from "@openrift/shared/deck-cards";
import type { CardType, DeckZone } from "@openrift/shared/types/enums";

import { m } from "@/paraglide/messages.js";

export function defaultImportDeckName(): string {
  return m.decks_import_default_deck_name();
}

/** The shape both the server save-cards mutation and the local-decks store accept. */
export interface ImportedDeckCard {
  cardId: string;
  zone: DeckZone;
  quantity: number;
  preferredPrintingId: string | null;
}

interface MatchedEntryLike {
  zone: DeckZone;
  entry: { quantity: number };
  resolvedCard: { cardId: string; displayName?: string; preferredPrintingId: string | null } | null;
}

/** Copies one imported row lost to the per-row cap. */
export interface ImportOverflow {
  name: string;
  count: number;
}

/** Merges matched entries into deck rows and reports the copies the per-row cap cut. */
export function mergeMatchedEntries(entries: readonly MatchedEntryLike[]): {
  cards: ImportedDeckCard[];
  overflow: ImportOverflow[];
} {
  const names = new Map<string, string>();
  const lines = entries.flatMap((entry) => {
    if (!entry.resolvedCard) {
      return [];
    }
    names.set(entry.resolvedCard.cardId, entry.resolvedCard.displayName ?? "");
    return [
      {
        cardId: entry.resolvedCard.cardId,
        zone: entry.zone,
        quantity: entry.entry.quantity,
        preferredPrintingId: entry.resolvedCard.preferredPrintingId,
      },
    ];
  });
  const { cards, overflow } = mergeDeckCardsWithOverflow(lines);
  return {
    cards,
    overflow: overflow.map(({ card, count }) => ({
      name: names.get(card.cardId) || card.cardId,
      count,
    })),
  };
}

export function dedupeMatchedEntries(entries: readonly MatchedEntryLike[]): ImportedDeckCard[] {
  return mergeMatchedEntries(entries).cards;
}

interface NamedDeckCard extends ImportedDeckCard {
  cardName: string;
  cardTypes: readonly CardType[];
  tags: readonly string[];
}

/**
 * The rows an archived deck copy stores: an extra card whose default-art row the deck already
 * holds is skipped, as the server clone does, and repeated rows merge under the per-row cap.
 */
export function archivedCopyCards(
  cards: readonly NamedDeckCard[],
  extraCards: readonly NamedDeckCard[],
): { cards: ImportedDeckCard[]; overflow: ImportOverflow[] } {
  const extras = extraCards.filter(
    (extra) =>
      !cards.some(
        (card) =>
          card.cardId === extra.cardId &&
          card.zone === extra.zone &&
          card.preferredPrintingId === null,
      ),
  );
  const lines = [...cards, ...extras].map((card) => ({
    cardId: card.cardId,
    zone: card.zone,
    quantity: card.quantity,
    preferredPrintingId: card.preferredPrintingId,
  }));
  const named = new Map([...cards, ...extras].map((card) => [card.cardId, card]));
  const merged = mergeDeckCardsWithOverflow(lines);
  return {
    cards: merged.cards,
    overflow: merged.overflow.map(({ card, count }) => {
      const source = named.get(card.cardId);
      return {
        name: source
          ? legendDisplayName({ name: source.cardName, types: source.cardTypes, tags: source.tags })
          : card.cardId,
        count,
      };
    }),
  };
}

/** The import notice for cut copies, or null when nothing was cut. */
export function importOverflowMessage(overflow: readonly ImportOverflow[]): string | null {
  if (overflow.length === 0) {
    return null;
  }
  return m.decks_import_over_limit({
    count: overflow.reduce((sum, row) => sum + row.count, 0),
    max: MAX_DECK_CARD_QUANTITY,
    cards: overflow.map((row) => row.name).join(", "),
  });
}
