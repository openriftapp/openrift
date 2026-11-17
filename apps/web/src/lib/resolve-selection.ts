import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";

import type { CardViewerItem } from "@/lib/card-viewer-types";

export interface SelectionAnchorState {
  selectedCard: Printing | null;
  selectedItemId: string | null;
  selectedZone: DeckZone | null;
  sourceIds: readonly string[];
  outlivesList: boolean;
}

export interface ResolvedSelection {
  card: Printing | null;
  index: number;
  item: CardViewerItem | undefined;
}

const NO_SELECTION: ResolvedSelection = { card: null, index: -1, item: undefined };

/**
 * A removed tile hands the selection to its nearest surviving neighbour from `sourceIds`.
 * Without one, an `outlivesList` selection stays shown without a tile and any other clears.
 */
export function resolveSelection(
  state: SelectionAnchorState,
  items: readonly CardViewerItem[],
): ResolvedSelection {
  const { selectedCard, selectedItemId, selectedZone, sourceIds, outlivesList } = state;
  if (selectedCard === null) {
    return NO_SELECTION;
  }
  const at = (index: number): ResolvedSelection =>
    index === -1
      ? { card: selectedCard, index: -1, item: undefined }
      : { card: selectedCard, index, item: items[index] };

  if (selectedItemId !== null) {
    const byId = items.findIndex((item) => item.id === selectedItemId);
    if (byId !== -1) {
      return at(byId);
    }
  }

  const inZone = (item: CardViewerItem) =>
    selectedZone === null || item.zone === undefined || item.zone === selectedZone;
  const key = sideKey(selectedCard);
  const byPrinting = items.findIndex((item) => inZone(item) && sideKey(item.printing) === key);
  if (byPrinting !== -1) {
    return at(byPrinting);
  }
  const byCard = items.findIndex(
    (item) => inZone(item) && item.printing.cardId === selectedCard.cardId,
  );
  if (byCard !== -1) {
    return at(byCard);
  }

  const position = selectedItemId === null ? -1 : sourceIds.indexOf(selectedItemId);
  if (position !== -1) {
    const indexById = new Map(items.map((item, index) => [item.id, index]));
    const neighbourIds = [
      ...sourceIds.slice(position + 1),
      ...sourceIds.slice(0, position).toReversed(),
    ];
    for (const id of neighbourIds) {
      const index = indexById.get(id);
      const item = index === undefined ? undefined : items[index];
      if (index !== undefined && item) {
        return { card: item.printing, index, item };
      }
    }
  }
  return outlivesList ? at(-1) : NO_SELECTION;
}
