/**
 * Allocation of a group's bulk-box contents against a member's wish demand.
 *
 * Each collection is allocated independently: a want fully covered by one box
 * still shows against another. Within one box, an entry never takes more than
 * its residual want, and a copy is never handed to two entries.
 */

/**
 * One wish entry, already expanded and netted by the matcher. Structurally the
 * demand-entry subset this allocation reads — the repo's richer entry passes
 * through unchanged.
 */
export interface BoxWantDemand {
  kind: "card" | "printing";
  cardId: string | null;
  printingId: string | null;
  buyQuantity: number;
  acceptablePrintingIds: ReadonlySet<string> | null;
}

export interface BoxAvailablePrinting {
  printingId: string;
  cardIds: readonly string[];
  quantity: number;
}

/** Already stripped of ineligible copies. */
export interface BoxCollectionAvailability {
  collectionId: string;
  printings: readonly BoxAvailablePrinting[];
}

export interface BoxWantRow {
  collectionId: string;
  printingId: string;
  cardId: string;
  fulfillableQuantity: number;
}

/** The cards of `printingId` that `entry` takes from: all of them for a printing want. */
function acceptedCards(entry: BoxWantDemand, printingId: string, cardIds: string[]): string[] {
  // Must apply the same printing gate as the match view applies to a supply copy.
  if (entry.acceptablePrintingIds !== null && !entry.acceptablePrintingIds.has(printingId)) {
    return [];
  }
  if (entry.kind === "printing") {
    return entry.printingId === printingId ? cardIds : [];
  }
  return cardIds.filter((cardId) => cardId === entry.cardId);
}

/**
 * Demand entries are consumed in build order, so a want split across several
 * lists spends the box in a stable sequence.
 */
export function allocateBoxWants(
  demand: readonly BoxWantDemand[],
  availableByCollection: readonly BoxCollectionAvailability[],
): BoxWantRow[] {
  const rows: BoxWantRow[] = [];
  for (const box of availableByCollection) {
    // A double-sided copy fills one want per card, so each card of a printing has its own pool.
    const remaining = new Map<string, Map<string, number>>();
    for (const printing of box.printings) {
      const byCard = remaining.get(printing.printingId) ?? new Map<string, number>();
      for (const cardId of printing.cardIds) {
        byCard.set(cardId, (byCard.get(cardId) ?? 0) + printing.quantity);
      }
      remaining.set(printing.printingId, byCard);
    }
    const taken = new Map<string, Map<string, number>>();
    for (const entry of demand) {
      let want = entry.buyQuantity;
      if (want <= 0) {
        continue;
      }
      for (const [printingId, byCard] of remaining) {
        if (want <= 0) {
          break;
        }
        const cards = acceptedCards(entry, printingId, [...byCard.keys()]);
        const available = Math.min(...cards.map((cardId) => byCard.get(cardId) ?? 0));
        if (cards.length === 0 || available <= 0) {
          continue;
        }
        const take = Math.min(want, available);
        want -= take;
        for (const cardId of cards) {
          byCard.set(cardId, (byCard.get(cardId) ?? 0) - take);
        }
        // A printing want takes the copy for all its cards but is one wanted card, listed first.
        const [listed] = cards;
        if (listed !== undefined) {
          const takenByCard = taken.get(printingId) ?? new Map<string, number>();
          takenByCard.set(listed, (takenByCard.get(listed) ?? 0) + take);
          taken.set(printingId, takenByCard);
        }
      }
    }
    // Emit in the box's own printing order so the result is stable.
    for (const printingId of remaining.keys()) {
      for (const [cardId, quantity] of taken.get(printingId) ?? []) {
        if (quantity > 0) {
          rows.push({
            collectionId: box.collectionId,
            printingId,
            cardId,
            fulfillableQuantity: quantity,
          });
        }
      }
    }
  }
  return rows;
}
