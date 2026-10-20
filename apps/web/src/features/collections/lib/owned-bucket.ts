import { getPlaysetSize } from "@openrift/shared/playset";
import { ownedTotalsByCard, sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";

import type { OwnedBucket } from "@/features/cards/lib/search-schemas";

export function bucketFor(total: number, playsetSize: number): OwnedBucket {
  if (total === 0) {
    return "none";
  }
  if (total < playsetSize) {
    return "partial";
  }
  if (total === playsetSize) {
    return "full";
  }
  return "extra";
}

/** In printing mode a side key's own count wins, so each side of a pair can be judged apart. */
function printingCount(printing: Printing, counts: Record<string, number>): number {
  return counts[sideKey(printing)] ?? counts[printing.printingId] ?? 0;
}

/**
 * `bucketBy: "card"` (default) aggregates owned copies across a card's
 * variants and keeps every printing of a card whose total matches; `"printing"`
 * buckets each printing on its own count instead.
 */
export function applyOwnedBucketFilter(
  cards: readonly Printing[],
  selected: readonly OwnedBucket[],
  ownedCountByPrinting: Record<string, number>,
  bucketBy: "card" | "printing" = "card",
): Printing[] {
  const selectedSet = new Set(selected);
  if (bucketBy === "printing") {
    return cards.filter((printing) =>
      selectedSet.has(
        bucketFor(
          printingCount(printing, ownedCountByPrinting),
          getPlaysetSize(printing.card.types, printing.card.keywords),
        ),
      ),
    );
  }
  const totalByCard = ownedTotalsByCard(cards, ownedCountByPrinting);
  const cardById = new Map<string, Printing["card"]>();
  for (const printing of cards) {
    if (!cardById.has(printing.cardId)) {
      cardById.set(printing.cardId, printing.card);
    }
  }
  const matchingCardIds = new Set<string>();
  for (const [cardId, total] of totalByCard) {
    const card = cardById.get(cardId);
    if (!card) {
      continue;
    }
    if (selectedSet.has(bucketFor(total, getPlaysetSize(card.types, card.keywords)))) {
      matchingCardIds.add(cardId);
    }
  }
  return cards.filter((printing) => matchingCardIds.has(printing.cardId));
}

/**
 * Same card-vs-printing split as {@link applyOwnedBucketFilter}, but ranges an
 * exact inclusive [min, max]; either bound `null` means unbounded on that side.
 */
export function applyOwnedCountFilter(
  cards: readonly Printing[],
  min: number | null,
  max: number | null,
  ownedCountByPrinting: Record<string, number>,
  bucketBy: "card" | "printing" = "card",
): Printing[] {
  const lowerBound = min ?? 0;
  const upperBound = max ?? Infinity;
  if (bucketBy === "printing") {
    return cards.filter((printing) => {
      const count = printingCount(printing, ownedCountByPrinting);
      return count >= lowerBound && count <= upperBound;
    });
  }
  const totalByCard = ownedTotalsByCard(cards, ownedCountByPrinting);
  return cards.filter((printing) => {
    const total = totalByCard.get(printing.cardId) ?? 0;
    return total >= lowerBound && total <= upperBound;
  });
}

/** Same card-vs-printing aggregation as {@link applyOwnedCountFilter}. */
export function maxOwnedCount(
  cards: readonly Printing[],
  ownedCountByPrinting: Record<string, number>,
  bucketBy: "card" | "printing" = "card",
): number {
  let max = 0;
  if (bucketBy === "printing") {
    for (const printing of cards) {
      const count = printingCount(printing, ownedCountByPrinting);
      if (count > max) {
        max = count;
      }
    }
    return max;
  }
  for (const total of ownedTotalsByCard(cards, ownedCountByPrinting).values()) {
    if (total > max) {
      max = total;
    }
  }
  return max;
}
