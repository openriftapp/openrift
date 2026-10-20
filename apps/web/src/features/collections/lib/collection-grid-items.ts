import { countPrintings, sideKey, uniquePrintings } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";

import { cardsViewTileKey } from "@/features/cards/lib/card-tiles";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { stackSides } from "@/features/collections/lib/stacked-entry";
import type { CardViewerItem } from "@/lib/card-viewer-types";

export interface CollectionGridItems {
  items: CardViewerItem[];
  stackByItemId: Map<string, StackedEntry>;
}

/**
 * Positional: an object literal argument makes the React Compiler treat the
 * grid's derived values as maybe-mutated and drop their memoization.
 */
export function buildCollectionGridItems(
  renderedCards: Printing[],
  stackByPrintingId: Map<string, StackedEntry>,
  collectionIdByCopyId: ReadonlyMap<string, string>,
  showLibrary: boolean,
  stacked: boolean,
): CollectionGridItems {
  const stackByItemId = new Map<string, StackedEntry>();

  if (showLibrary) {
    const items = renderedCards.map((printing) => {
      const stack = stackByPrintingId.get(printing.printingId);
      if (stack) {
        stackByItemId.set(sideKey(printing), stack);
      }
      return { id: sideKey(printing), printing };
    });
    return { items, stackByItemId };
  }

  const owned = renderedCards
    .map((printing) => ({ printing, stack: stackByPrintingId.get(printing.printingId) }))
    .filter(
      (entry): entry is { printing: Printing; stack: StackedEntry } => entry.stack !== undefined,
    );

  if (stacked) {
    const items = owned.map((entry) => {
      stackByItemId.set(sideKey(entry.printing), entry.stack);
      return { id: sideKey(entry.printing), printing: entry.printing };
    });
    return { items, stackByItemId };
  }

  // A copy is one tile however many of its printing's sides matched.
  const seenPrintings = new Set<string>();
  const items = owned
    .filter((entry) => {
      if (seenPrintings.has(entry.stack.printingId)) {
        return false;
      }
      seenPrintings.add(entry.stack.printingId);
      return true;
    })
    .flatMap((entry) =>
      entry.stack.copyIds.map((copyId) => {
        stackByItemId.set(copyId, entry.stack);
        return {
          id: copyId,
          printing: entry.printing,
          collectionId: collectionIdByCopyId.get(copyId),
        };
      }),
    );
  return { items, stackByItemId };
}

export function copyIdsShareOneCard(copyIds: string[], stacks: StackedEntry[]): boolean {
  if (copyIds.length <= 1) {
    return true;
  }
  // A double-sided copy shows both of its cards, so it shares a card with copies of either.
  const cardIdsByCopyId = new Map<string, Set<string>>();
  for (const stack of stacks) {
    const cardIds = new Set(stackSides(stack).map((side) => side.cardId));
    for (const copyId of stack.copyIds) {
      cardIdsByCopyId.set(copyId, cardIds);
    }
  }
  const resolved = copyIds.map((copyId) => cardIdsByCopyId.get(copyId));
  if (resolved.every((cardIds) => cardIds === undefined)) {
    return true;
  }
  const [first, ...rest] = resolved;
  return [...(first ?? [])].some((cardId) => rest.every((cardIds) => cardIds?.has(cardId)));
}

export interface CardsViewTileIndex {
  allCopyIdsByTile: Map<string, string[]>;
  allPrintingIdsByTile: Map<string, string[]>;
}

export const EMPTY_TILE_INDEX: CardsViewTileIndex = {
  allCopyIdsByTile: new Map(),
  allPrintingIdsByTile: new Map(),
};

/** A double-sided stack belongs to the tile of the card on each of its sides. */
export function buildCardsViewTileIndex(
  stacks: readonly StackedEntry[],
  groupBy: GroupByField,
): CardsViewTileIndex {
  const allCopyIdsByTile = new Map<string, string[]>();
  const allPrintingIdsByTile = new Map<string, string[]>();
  for (const stack of stacks) {
    const tileKeys = new Set(stackSides(stack).map((side) => cardsViewTileKey(side, groupBy)));
    for (const tileKey of tileKeys) {
      allCopyIdsByTile.set(tileKey, [...(allCopyIdsByTile.get(tileKey) ?? []), ...stack.copyIds]);
      allPrintingIdsByTile.set(tileKey, [
        ...(allPrintingIdsByTile.get(tileKey) ?? []),
        stack.printingId,
      ]);
    }
  }
  return { allCopyIdsByTile, allPrintingIdsByTile };
}

/** How many cards, printings or copies the filtered grid holds, each double-sided printing once. */
export function filteredCollectionCount(
  sortedCards: readonly Printing[],
  view: "cards" | "printings" | "copies",
  dataView: "cards" | "printings",
  stackByPrintingId: ReadonlyMap<string, StackedEntry>,
): number {
  if (view === "copies") {
    return uniquePrintings(sortedCards).reduce(
      (sum, card) => sum + (stackByPrintingId.get(card.printingId)?.copyIds.length ?? 0),
      0,
    );
  }
  // A card in several set or rarity sections has several tiles.
  return dataView === "cards"
    ? new Set(sortedCards.map((card) => card.cardId)).size
    : countPrintings(sortedCards);
}
