import { legendDisplayName } from "@openrift/shared/card-name";
import { sideKey } from "@openrift/shared/printing-side";
import type { Printing } from "@openrift/shared/types/catalog";
import type { GroupByField } from "@openrift/shared/types/search";
import { useEffect } from "react";

import { cardsViewTileKey, splitsCardIntoTiles } from "@/features/cards/lib/card-tiles";
import type { CollectionContextAction } from "@/features/cards/stores/card-row-actions-store";
import { useSiblingOverrideStore } from "@/features/cards/stores/sibling-override-store";
import { buildOnDecrement } from "@/features/collections/hooks/collection-decrement";
import type { useQuickAddActions } from "@/features/collections/hooks/use-quick-add-actions";
import { useRowActionHandlers } from "@/features/collections/hooks/use-row-action-handlers";
import {
  computeDragSelectionSummary,
  dragSelectionNoun,
} from "@/features/collections/lib/collection-drag";
import {
  buildCardsViewTileIndex,
  EMPTY_TILE_INDEX,
} from "@/features/collections/lib/collection-grid-items";
import { resolveContextActionTarget } from "@/features/collections/lib/stack-selection";
import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { stackSides } from "@/features/collections/lib/stacked-entry";
import { useAddModeStore } from "@/features/collections/stores/add-mode-store";
import type { VariantPopoverIntent } from "@/features/collections/stores/add-mode-store";
import { useCollectionOverlayStore } from "@/features/collections/stores/collection-overlay-store";
import { useDragPreviewStore } from "@/features/collections/stores/drag-preview-store";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { computeShiftRange } from "@/lib/shift-range";
import { useSelectionStore } from "@/stores/selection-store";

function printingsArrayEqual(a: readonly Printing[], b: readonly Printing[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let idx = 0; idx < a.length; idx++) {
    if (a[idx] !== b[idx]) {
      return false;
    }
  }
  return true;
}

interface UseCollectionGridSelectionParams {
  items: CardViewerItem[];
  stackByItemId: Map<string, StackedEntry>;
  stackByPrintingId: Map<string, StackedEntry>;
  stacks: StackedEntry[];
  tileGroupBy: GroupByField;
  dataView: "cards" | "printings";
  view: "cards" | "printings" | "copies";
  stacked: boolean;
  mode: "browse" | "select";
  setSelectMode: (value: boolean) => void;
  selected: Set<string>;
  toggleSelect: (itemId: string) => void;
  toggleStack: (copyIds: string[]) => void;
  clearSelection: () => void;
  getLastSelectedItemId: () => string | null;
  setLastSelectedItemId: (itemId: string) => void;
  addToSelection: (ids: string[]) => void;
  handleQuickAdd: ReturnType<typeof useQuickAddActions>["handleQuickAdd"];
  tryUndoAdd: ReturnType<typeof useQuickAddActions>["tryUndoAdd"];
  handleOpenVariants: ReturnType<typeof useQuickAddActions>["handleOpenVariants"];
  handleTake: (itemId: string, count: number, printing?: Printing) => void;
  setLendTarget: (target: { printing: Printing; maxQuantity: number } | null) => void;
  openAction: (action: CollectionContextAction, copyIds: string[]) => void;
}

export function useCollectionGridSelection({
  items,
  stackByItemId,
  stackByPrintingId,
  stacks,
  tileGroupBy,
  dataView,
  view,
  stacked,
  mode,
  setSelectMode,
  selected,
  toggleSelect,
  toggleStack,
  clearSelection,
  getLastSelectedItemId,
  setLastSelectedItemId,
  addToSelection,
  handleQuickAdd,
  tryUndoAdd,
  handleOpenVariants,
  handleTake,
  setLendTarget,
  openAction,
}: UseCollectionGridSelectionParams) {
  // Keyed by tile (cardId, or cardId|set / cardId|rarity when split) so a card
  // owned across sets keeps each set tile's copies separate.
  const { allCopyIdsByTile, allPrintingIdsByTile } =
    dataView === "cards" ? buildCardsViewTileIndex(stacks, tileGroupBy) : EMPTY_TILE_INDEX;
  const printingByItemId = new Map(items.map((item) => [item.id, item.printing]));

  // Multiple cells can share a cardId when split into tiles, so selection
  // must navigate by printing to land on the tile the user clicked.
  const findBy =
    dataView === "cards" && !splitsCardIntoTiles(tileGroupBy) ? "card" : ("printing" as const);

  // Skips the store update when the walk returns the same printing refs, or
  // cells re-render on every +/- click.
  const dragSummary = computeDragSelectionSummary({
    mode,
    selected,
    items,
    stackByItemId,
    stacked,
    countPrintings: view === "printings",
  });
  const dragNoun = dragSelectionNoun(view);
  useEffect(() => {
    const state = useDragPreviewStore.getState();
    if (
      !printingsArrayEqual(dragSummary.printings, state.preview) ||
      dragSummary.count !== state.selectionCount ||
      dragNoun !== state.selectionNoun
    ) {
      state.setPreview(dragSummary.printings, dragSummary.count, dragNoun);
    }
  });

  // `itemId` pins the click to its tile: copies view has one tile per copy, so
  // a printing lookup alone would always land on the first of them.
  const handleGridCardClick = (printing: Printing, itemId?: string) => {
    useAddModeStore.getState().closeVariants();
    useSelectionStore.getState().selectCard(printing, items, findBy, { itemId });
  };

  const handleSiblingClick = (printing: Printing) => {
    handleGridCardClick(printing);
    useSiblingOverrideStore
      .getState()
      .setOverride("collection", printing.cardId, sideKey(printing));
  };

  const toggleStackForItem = (itemId: string, stack: StackedEntry) => {
    if (stacked) {
      const tilePrinting = printingByItemId.get(itemId) ?? stack.printing;
      const cardCopyIds =
        allCopyIdsByTile.get(cardsViewTileKey(tilePrinting, tileGroupBy)) ?? stack.copyIds;
      toggleStack(cardCopyIds);
    } else {
      toggleSelect(itemId);
    }
  };

  // In stacked views a tile stands for every copy of the card, so the range
  // accumulates copy ids; in copies view the tile is the copy.
  const shiftSelectRange = (itemId: string) => {
    const rangeIds = computeShiftRange({
      items,
      lastSelectedItemId: getLastSelectedItemId(),
      itemId,
      idsForItem: (rangeItem) => {
        if (!stacked) {
          return [rangeItem.id];
        }
        return (
          allCopyIdsByTile.get(cardsViewTileKey(rangeItem.printing, tileGroupBy)) ??
          stackByItemId.get(rangeItem.id)?.copyIds ??
          []
        );
      },
    });
    if (rangeIds === null) {
      const stack = stackByItemId.get(itemId);
      if (stack) {
        toggleStackForItem(itemId, stack);
        setLastSelectedItemId(itemId);
      }
      return;
    }
    addToSelection(rangeIds);
    setLastSelectedItemId(itemId);
  };

  // See resolveContextActionTarget for the browse-vs-select rules.
  const handleContextAction = (
    itemId: string,
    action: CollectionContextAction,
    printing?: Printing,
  ) => {
    const stack = stackByItemId.get(itemId);
    if (!stack) {
      return;
    }
    // Lend targets one printing, never the multi-selection: a loan row is a
    // single printing + quantity.
    if (action === "lend") {
      const lendStack = (printing && stackByPrintingId.get(printing.printingId)) ?? stack;
      setLendTarget({
        printing: printing ?? lendStack.printing,
        maxQuantity: stacked ? lendStack.copyIds.length : 1,
      });
      return;
    }
    const tilePrinting = printing ?? printingByItemId.get(itemId) ?? stack.printing;
    const cardCopyIds = stacked
      ? (allCopyIdsByTile.get(cardsViewTileKey(tilePrinting, tileGroupBy)) ?? stack.copyIds)
      : [itemId];
    // Copy details always targets the clicked tile (never the selection): the
    // dialog edits one copy at a time, so selection narrowing doesn't apply.
    if (action === "copyDetails") {
      const idSet = new Set(cardCopyIds);
      const printingByCopyId = new Map<string, Printing>();
      for (const entry of stacks) {
        for (const copyId of entry.copyIds) {
          if (idSet.has(copyId)) {
            printingByCopyId.set(
              copyId,
              stackSides(entry).find((side) => side.cardId === tilePrinting.cardId) ??
                entry.printing,
            );
          }
        }
      }
      useCollectionOverlayStore.getState().setCopyDetailsTarget({
        copyIds: cardCopyIds,
        cardName: legendDisplayName(tilePrinting.card),
        printingByCopyId,
      });
      return;
    }
    const { copyIds, narrowSelectionTo } = resolveContextActionTarget({
      mode,
      stacked,
      itemId,
      cardCopyIds,
      selected,
    });
    if (narrowSelectionTo) {
      clearSelection();
      addToSelection(narrowSelectionTo);
      setLastSelectedItemId(itemId);
    }
    openAction(action, copyIds);
  };

  // When the tile is split by set, the +/- variant popover offers only the
  // tile's own set so it can't add or remove a printing from another set.
  const openVariantsForTile = handleOpenVariants
    ? (printing: Printing, anchorEl: HTMLElement, intent: VariantPopoverIntent) =>
        // Cards view shows every variant of the card; printings/copies view
        // scopes to the one printing the tile stands for.
        handleOpenVariants(printing, anchorEl, intent, tileGroupBy === "set", dataView !== "cards")
    : undefined;

  useRowActionHandlers("collection", {
    onRowClick: handleGridCardClick,
    onSiblingClick: handleSiblingClick,
    onIncrement:
      handleQuickAdd &&
      ((printing, modifiers, quantity) => void handleQuickAdd(printing, modifiers, quantity)),
    onDecrement: buildOnDecrement({
      dataView,
      groupBy: tileGroupBy,
      ownedPrintingIdsByTile: allPrintingIdsByTile,
      handleOpenVariants: openVariantsForTile,
      tryUndoAdd,
    }),
    onOpenVariants: openVariantsForTile,
    onItemClick: (itemId, printing, modifiers) => {
      const stack = stackByItemId.get(itemId);
      // Browse mode: ctrl-click on an owned card flips into select mode and
      // toggles. Plain click opens the detail pane.
      if (mode === "browse") {
        if (modifiers.ctrl && stack) {
          setSelectMode(true);
          toggleStackForItem(itemId, stack);
          setLastSelectedItemId(itemId);
          return;
        }
        handleGridCardClick(printing, itemId);
        return;
      }
      // Select mode: shift-click extends the range, regular click toggles.
      if (!stack) {
        return;
      }
      if (modifiers.shift) {
        shiftSelectRange(itemId);
      } else {
        toggleStackForItem(itemId, stack);
        setLastSelectedItemId(itemId);
      }
    },
    onItemToggle: (itemId) => {
      const stack = stackByItemId.get(itemId);
      if (!stack) {
        return;
      }
      toggleStackForItem(itemId, stack);
      setLastSelectedItemId(itemId);
    },
    onContextAction: handleContextAction,
    onTake: handleTake,
  });

  return {
    allCopyIdsByTile,
  };
}
