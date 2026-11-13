import { priceTotal } from "@openrift/shared/card-price";
import type { MetaListStatus } from "@openrift/shared/types/enums";

import type { OwnershipBandSegments } from "@/features/decks/lib/deck-ownership-band";
import { ownershipBandSegments } from "@/features/decks/lib/deck-ownership-band";

export interface MetaDeckCards {
  main: ReadonlyMap<string, number>;
  side: ReadonlyMap<string, number>;
}

export type MetaDeckCardsByDeck = ReadonlyMap<string, MetaDeckCards>;

export interface MetaDeckCost {
  needed: number;
  owned: number | undefined;
  value: number | undefined;
  toComplete: number | undefined;
  unpriced: number;
  unpricedMissing: number;
}

// A pair naming a card outside the pool is dropped, as is a trailing index without a quantity.
function decodePairs(pairs: readonly number[], cards: readonly string[]): Map<string, number> {
  const requirements = new Map<string, number>();
  for (const [at, cardIndex] of pairs.entries()) {
    if (at % 2 !== 0) {
      continue;
    }
    const quantity = pairs[at + 1];
    const cardId = cards[cardIndex];
    if (quantity === undefined || cardId === undefined) {
      continue;
    }
    requirements.set(cardId, (requirements.get(cardId) ?? 0) + quantity);
  }
  return requirements;
}

export function decodeMetaDeckCardIndex(index: {
  cards: readonly string[];
  decks: readonly { deckId: string; entries: readonly number[]; sideboard: readonly number[] }[];
}): Map<string, MetaDeckCards> {
  const byDeck = new Map<string, MetaDeckCards>();
  for (const deck of index.decks) {
    byDeck.set(deck.deckId, {
      main: decodePairs(deck.entries, index.cards),
      side: decodePairs(deck.sideboard, index.cards),
    });
  }
  return byDeck;
}

/** Summed over every printing: the archive records which card was played, not which printing. */
export function ownedCountsByCardId(
  ownedByPrinting: Readonly<Record<string, number>>,
  printingsByCardId: ReadonlyMap<string, readonly { printingId: string }[]>,
): Map<string, number> {
  const owned = new Map<string, number>();
  for (const [cardId, printings] of printingsByCardId) {
    let total = 0;
    for (const printingId of new Set(printings.map((printing) => printing.printingId))) {
      total += ownedByPrinting[printingId] ?? 0;
    }
    if (total > 0) {
      owned.set(cardId, total);
    }
  }
  return owned;
}

function scopedQuantities(cards: MetaDeckCards, includeSideboard: boolean): Map<string, number> {
  const quantities = new Map(cards.main);
  if (includeSideboard) {
    for (const [cardId, quantity] of cards.side) {
      quantities.set(cardId, (quantities.get(cardId) ?? 0) + quantity);
    }
  }
  return quantities;
}

export function partialListDeckIds(
  rows: readonly { deckId: string | null; listStatus: MetaListStatus }[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.deckId !== null && row.listStatus === "partial") {
      ids.add(row.deckId);
    }
  }
  return ids;
}

export function metaDeckCosts(
  decks: MetaDeckCardsByDeck,
  options: {
    includeSideboard: boolean;
    prices: ReadonlyMap<string, number>;
    ownedByCardId?: ReadonlyMap<string, number>;
    partialDeckIds?: ReadonlySet<string>;
  },
): Map<string, MetaDeckCost> {
  const byDeck = new Map<string, MetaDeckCost>();
  for (const [deckId, cards] of decks) {
    let needed = 0;
    let owned = 0;
    const valueRows: { price: number | undefined; quantity: number }[] = [];
    const missingRows: { price: number | undefined; quantity: number }[] = [];
    for (const [cardId, quantity] of scopedQuantities(cards, options.includeSideboard)) {
      const price = options.prices.get(cardId);
      const held = Math.min(quantity, options.ownedByCardId?.get(cardId) ?? 0);
      needed += quantity;
      owned += held;
      valueRows.push({ price, quantity });
      missingRows.push({ price, quantity: quantity - held });
    }
    if (options.partialDeckIds?.has(deckId)) {
      byDeck.set(deckId, {
        needed,
        owned: undefined,
        value: undefined,
        toComplete: undefined,
        unpriced: 0,
        unpricedMissing: 0,
      });
      continue;
    }
    const withCollection = options.ownedByCardId !== undefined;
    const value = priceTotal(valueRows);
    const toComplete = priceTotal(missingRows);
    byDeck.set(deckId, {
      needed,
      owned: withCollection ? owned : undefined,
      value: value.value,
      toComplete: withCollection ? toComplete.value : undefined,
      unpriced: value.unpriced,
      unpricedMissing: withCollection ? toComplete.unpriced : 0,
    });
  }
  return byDeck;
}

/** Copies of the thumbnail's own printing fill first, the card's other printings after. */
export function metaCardOwnershipBand(
  card: { cardId: string; quantity: number },
  displayedPrintingId: string | null,
  ownedByPrinting: Readonly<Record<string, number>>,
  printingsByCardId: ReadonlyMap<string, readonly { printingId: string }[]>,
): OwnershipBandSegments {
  let ownedOfDisplayed = 0;
  let ownedOfOthers = 0;
  const printingIds = new Set(
    (printingsByCardId.get(card.cardId) ?? []).map((printing) => printing.printingId),
  );
  for (const printingId of printingIds) {
    const owned = ownedByPrinting[printingId] ?? 0;
    if (printingId === displayedPrintingId) {
      ownedOfDisplayed += owned;
    } else {
      ownedOfOthers += owned;
    }
  }
  return ownershipBandSegments(card.quantity, ownedOfDisplayed, ownedOfOthers);
}
