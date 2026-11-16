import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";
import { create } from "zustand";

import type { CardViewerItem } from "@/lib/card-viewer-types";
import type { SelectionAnchorState } from "@/lib/resolve-selection";

/**
 * Where a click landed, when the caller knows more than which printing it was.
 */
interface SelectionAnchor {
  zone?: DeckZone;
  itemId?: string;
}

interface SelectionState extends SelectionAnchorState {
  detailOpen: boolean;

  selectCard: (
    printing: Printing,
    items: readonly CardViewerItem[],
    findBy: "card" | "printing",
    anchor?: SelectionAnchor,
  ) => void;
  navigateToItem: (items: readonly CardViewerItem[], index: number, printing?: Printing) => void;
  setSelectedCard: (printing: Printing) => void;
  closeDetail: () => void;
}

function findAnchorIndex(
  items: readonly CardViewerItem[],
  printing: Printing,
  findBy: "card" | "printing",
  anchor?: SelectionAnchor,
): number {
  if (anchor?.itemId !== undefined) {
    const byItem = items.findIndex((item) => item.id === anchor.itemId);
    if (byItem !== -1) {
      return byItem;
    }
  }
  if (findBy === "printing") {
    return items.findIndex((item) => sideKey(item.printing) === sideKey(printing));
  }
  if (anchor?.zone === undefined) {
    return items.findIndex((item) => item.printing.cardId === printing.cardId);
  }
  return items.findIndex(
    (item) => item.zone === anchor.zone && item.printing.cardId === printing.cardId,
  );
}

const CLEARED = {
  selectedCard: null,
  selectedItemId: null,
  selectedZone: null,
  sourceIds: [],
  detailOpen: false,
} satisfies Partial<SelectionState>;

export const useSelectionStore = create<SelectionState>()((set) => ({
  ...CLEARED,

  selectCard: (printing, items, findBy, anchor) => {
    const item = items[findAnchorIndex(items, printing, findBy, anchor)];
    set({
      selectedCard: printing,
      selectedItemId: item?.id ?? null,
      sourceIds: items.map((entry) => entry.id),
      selectedZone: anchor?.zone ?? null,
      detailOpen: true,
    });
  },

  navigateToItem: (items, index, printing) => {
    const item = items[index];
    if (!item) {
      return;
    }
    set({
      selectedCard: printing ?? item.printing,
      selectedItemId: item.id,
      sourceIds: items.map((entry) => entry.id),
      selectedZone: item.zone ?? null,
    });
  },

  setSelectedCard: (printing) => set({ selectedCard: printing }),

  closeDetail: () => set(CLEARED),
}));
