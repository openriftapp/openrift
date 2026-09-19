import type {
  ListEntryDetailResponse,
  ListKind,
  ListResponse,
} from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ListRule } from "@openrift/shared/types/list-rule";
import type { GroupByField } from "@openrift/shared/types/search";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCardSelection } from "@/features/cards/hooks/use-card-selection";
import type {
  CardRowClickModifiers,
  ListBulkAction,
} from "@/features/cards/stores/card-row-actions-store";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import { useSiblingOverrideStore } from "@/features/cards/stores/sibling-override-store";
import { useCopyListMemberships, useDisposeCopies } from "@/features/collections/hooks/use-copies";
import { useRowActionHandlers } from "@/features/collections/hooks/use-row-action-handlers";
import {
  computeShiftRange,
  resolveContextActionTarget,
} from "@/features/collections/lib/stack-selection";
import {
  useBulkAddListEntries,
  useBulkRemoveListEntries,
  useLists,
  useMoveListEntries,
  useUpdateList,
  useUpdateListEntry,
} from "@/features/lists/hooks/use-lists";
import {
  entrySelectionId,
  isRuleSelectionId,
  resolveCopyMoveTarget,
  selectableEntryIds,
} from "@/features/lists/lib/list-entries";
import {
  entrySelectionEntry,
  hasRuleSelection,
  listSelectionSubjects,
  orderedSelectedEntryIds,
  splitSelectionParts,
} from "@/features/lists/lib/list-entry-selection";
import type {
  AddEntryToCollectionRequest,
  MoveEntrySubject,
  MoveMode,
  MoveResolution,
} from "@/features/lists/lib/list-move";
import { ruleEntryCopyInputs, ruleEntryRef } from "@/features/lists/lib/list-move";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import type { RuleExcludeTarget } from "@/features/rules/lib/rule-exclude";
import { excludeEntryFromRules } from "@/features/rules/lib/rule-exclude";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { useUserId } from "@/lib/auth-session";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { m } from "@/paraglide/messages.js";
import { useSelectionStore } from "@/stores/selection-store";

export interface UseListEntryBrowserSelectionParams {
  listId: string;
  kind: ListKind;
  intent: "wish" | "trade" | "organize";
  rules: ListRule[];
  entries: ListEntryDetailResponse[];
  showLibrary: boolean;
  isMobile: boolean;
  view: "cards" | "printings" | "copies";
  groupBy: GroupByField;
  allPrintings: Printing[];
  items: CardViewerItem[];
  entryByItemId: Map<string, ListEntryDetailResponse>;
  entryByKey: Map<string, ListEntryDetailResponse>;
  printingByEntryId: Map<string, Printing>;
  setSearch: (query: string) => void;
  setPrefDialogEntryIds: (entryIds: string[]) => void;
  onRemoveEntry: (entryId: string, cardName: string) => void;
  onQuantityChange: (entryId: string, quantity: number) => void;
  isQuantityPendingFor: (entryId: string) => boolean;
}

export function useListEntryBrowserSelection({
  listId,
  kind,
  intent,
  rules,
  entries,
  showLibrary,
  isMobile,
  view,
  groupBy,
  allPrintings,
  items,
  entryByItemId,
  entryByKey,
  printingByEntryId,
  setSearch,
  setPrefDialogEntryIds,
  onRemoveEntry,
  onQuantityChange,
  isQuantityPendingFor,
}: UseListEntryBrowserSelectionParams) {
  const {
    selected,
    selectMode,
    setSelectMode,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    resetSelection,
    getLastSelectedItemId,
    setLastSelectedItemId,
    addToSelection,
  } = useCardSelection();
  const mode: "browse" | "select" = selectMode ? "select" : "browse";
  const [actionEntryIds, setActionEntryIds] = useState<string[]>([]);
  const actionRowIds = actionEntryIds.filter((id) => !isRuleSelectionId(id));
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<MoveMode>("move");
  const [removeOpen, setRemoveOpen] = useState(false);
  const { data: allLists } = useLists();
  const moveEntries = useMoveListEntries();
  const bulkRemove = useBulkRemoveListEntries();
  const updateList = useUpdateList();

  const handleExcludeFromRule = (target: RuleExcludeTarget) => {
    const next = excludeEntryFromRules(rules, target, allPrintings);
    if (!next) {
      return;
    }
    // No onError here: a per-call handler runs in addition to the global mutation
    // onError, which already toasts the server's message.
    updateList.mutate({ listId, rules: next });
  };

  // Take-off's sold outcome reuses the /collections dispose flow: it hard-deletes the
  // copies, cascading them off every list. `listId` is excluded from the warning list
  // so this list isn't named among the "other lists" the copies also sit on.
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [takeOffOpen, setTakeOffOpen] = useState(false);
  const disposeCopies = useDisposeCopies();
  const copyIdByEntryId = new Map(
    entries.flatMap((entry) => (entry.kind === "copy" ? [[entry.id, entry.copyId] as const] : [])),
  );
  const entriesToCopyIds = (entryIds: readonly string[]): string[] =>
    entryIds.flatMap((entryId) => {
      const copyId = copyIdByEntryId.get(entryId);
      return copyId ? [copyId] : [];
    });
  const takeOffCopyIds = entriesToCopyIds(actionRowIds);
  const takeOffMemberships = useCopyListMemberships(takeOffCopyIds, takeOffOpen, listId);
  // Copies pinned to a live trade block the sold outcome: disposing one would break the trade.
  const reservedEntryIds = new Set(
    entries.flatMap((entry) => (entry.kind === "copy" && entry.reserved ? [entry.id] : [])),
  );
  const takeOffReservedCount = actionRowIds.filter((id) => reservedEntryIds.has(id)).length;

  // Targeted by copy id, which a rule-produced entry has even without a `list_entries` row.
  const [moveToCollectionOpen, setMoveToCollectionOpen] = useState(false);
  const [moveCopyIds, setMoveCopyIds] = useState<string[]>([]);
  const handleMoveCopyToCollection = (copyId: string) => {
    setMoveCopyIds(resolveCopyMoveTarget(entryByItemId, selected, copyId));
    setMoveToCollectionOpen(true);
  };

  const [addToCollectionIds, setAddToCollectionIds] = useState<string[]>([]);
  const addToCollectionSubjects = listSelectionSubjects(
    orderedSelectedEntryIds(new Set(addToCollectionIds), entryByItemId),
    kind,
    entryByItemId,
    printingByEntryId,
  );
  const addToCollectionRequest: AddEntryToCollectionRequest | null =
    addToCollectionSubjects.length === 0 ? null : { subjects: addToCollectionSubjects };
  const closeAddToCollection = () => setAddToCollectionIds([]);

  useScopeEffect(listId, () => resetSelection());
  useScopeEffect(showLibrary, (library) => {
    if (library) {
      resetSelection();
    }
  });

  const bulkAddEntries = useBulkAddListEntries();
  const updateEntryMutation = useUpdateListEntry();

  // Grouped-by-set tiles are per (cardId, setId), so clicks navigate by printing, not card.
  const findBy: "card" | "printing" = view === "cards" && groupBy !== "set" ? "card" : "printing";

  const handleCardClick = (printing: Printing) => {
    useSelectionStore.getState().selectCard(printing, items, findBy);
  };

  const selectedCard = useSelectionStore((s) => s.selectedCard);
  const selectedIndex = useSelectionStore((s) => s.selectedIndex);
  useEffect(() => {
    useSelectionStore.getState().reconcileSelection(items);
  }, [items]);
  const indexAnchor =
    selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : undefined;
  const gridSelectedId =
    indexAnchor?.id ??
    (selectedCard
      ? (items.find((item) => item.printing.id === selectedCard.id)?.id ??
        (view === "cards"
          ? items.find((item) => item.printing.cardId === selectedCard.cardId)?.id
          : undefined))
      : undefined);
  useEffect(() => {
    useGridFocusStore.getState().setSelectedItemId(gridSelectedId ?? null);
  }, [gridSelectedId]);

  const handleSiblingClick = (printing: Printing) => {
    handleCardClick(printing);
    useSiblingOverrideStore.getState().setOverride("list", printing.cardId, printing.id);
  };

  const handleSearchAndClose = (query: string) => {
    setSearch(query);
    if (isMobile) {
      useSelectionStore.getState().closeDetail();
    }
  };

  const handleIncrement = (
    printing: Printing,
    _modifiers?: CardRowClickModifiers,
    quantity = 1,
  ) => {
    // Lists upsert by (listId, cardId|printingId): adding the same key twice bumps
    // quantity server-side. Anything above 1 comes from the grid's digit-key shortcut.
    const bump = Math.max(1, quantity);
    const entryShape =
      kind === "card"
        ? { cardId: printing.cardId, quantity: bump }
        : { printingId: printing.id, quantity: bump };
    bulkAddEntries.mutate({ listId, entries: [entryShape] });
  };

  const handleDecrement = (printing: Printing) => {
    const key = kind === "card" ? printing.cardId : printing.id;
    const entry = entryByKey.get(key);
    // Rule-derived entries (null id) can't be decremented.
    if (!entry || entry.id === null || entry.quantity <= 1) {
      return;
    }
    updateEntryMutation.mutate({ listId, entryId: entry.id, quantity: entry.quantity - 1 });
  };

  const enterSelectMode = () => setSelectMode(true);
  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const selectableIds = selectableEntryIds(items, entryByItemId);
  const selectAll = () => toggleSelectAll(selectableIds);
  const isAllSelected = selectableIds.length > 0 && selected.size === selectableIds.length;

  const shiftSelectRange = (itemId: string) => {
    const targetEntry = entryByItemId.get(itemId);
    if (!targetEntry) {
      return;
    }
    const rangeIds = computeShiftRange({
      items,
      lastSelectedItemId: getLastSelectedItemId(),
      itemId,
      idsForItem: (rangeItem) => {
        const rangeEntry = entryByItemId.get(rangeItem.id);
        return rangeEntry ? [entrySelectionId(rangeItem.id, rangeEntry)] : [];
      },
    });
    if (rangeIds === null) {
      toggleSelect(entrySelectionId(itemId, targetEntry));
      setLastSelectedItemId(itemId);
      return;
    }
    addToSelection(rangeIds);
    setLastSelectedItemId(itemId);
  };

  /**
   * A context action on a selected tile runs on the whole selection; on any
   * other tile it narrows the selection to that one first.
   */
  const narrowToSelection = (selectionId: string): string[] => {
    const { copyIds, narrowSelectionTo } = resolveContextActionTarget({
      mode,
      stacked: false,
      itemId: selectionId,
      cardCopyIds: [selectionId],
      selected,
    });
    if (narrowSelectionTo) {
      clearSelection();
      addToSelection(narrowSelectionTo);
      setLastSelectedItemId(selectionId);
    }
    return copyIds;
  };

  const openListAction = (action: ListBulkAction, entryIds: string[]) => {
    setActionEntryIds(entryIds);
    if (action === "move" || action === "copy") {
      setMoveMode(action);
      setMoveOpen(true);
    } else if (action === "takeOff") {
      setTakeOffOpen(true);
    } else {
      setRemoveOpen(true);
    }
  };

  // A wider-kind target needs a printing or copies picked, which only makes sense per card.
  const moveSubject: MoveEntrySubject | null = (() => {
    const [id] = actionEntryIds;
    if (actionEntryIds.length !== 1 || id === undefined) {
      return null;
    }
    const entry = entrySelectionEntry(id, entryByItemId);
    const printing = printingByEntryId.get(id);
    if (!entry || !printing) {
      return null;
    }
    const rule = isRuleSelectionId(id);
    return {
      entryIds: rule ? [] : [id],
      ruleEntry: rule ? ruleEntryRef(entry) : undefined,
      sourceKind: kind,
      sourceIntent: intent,
      totalQuantity: entry.quantity,
      printing,
      cardName: entry.cardName,
    };
  })();

  // A selection can hold both kinds: rows the API moves and rule entries it can
  // only re-add on the target list.
  const runBulkMove = async (toList: ListResponse, resolution: MoveResolution | null) => {
    const { entryIds, ruleSubjects } = splitSelectionParts(
      actionEntryIds,
      entryByItemId,
      printingByEntryId,
    );
    const added = ruleSubjects.flatMap((subject) =>
      ruleEntryCopyInputs(subject, toList.kind, resolution),
    );
    const resolutions = resolution
      ? entryIds.map((entryId) => ({ entryId, ...resolution }))
      : undefined;
    const movePromise =
      entryIds.length > 0
        ? moveEntries.mutateAsync({
            fromListId: listId,
            toListId: toList.id,
            entryIds,
            mode: moveMode,
            resolutions,
          })
        : // oxlint-disable-next-line unicorn/no-useless-undefined -- typed as Promise<undefined>, not Promise<void>
          Promise.resolve(undefined);
    const addPromise =
      added.length > 0
        ? bulkAddEntries.mutateAsync({ listId: toList.id, entries: added })
        : // oxlint-disable-next-line unicorn/no-useless-undefined -- typed as Promise<undefined>, not Promise<void>
          Promise.resolve(undefined);

    // The compiler can't optimize a conditional inside try/catch, so the
    // await is the only thing the try block does.
    let results: [
      Awaited<ReturnType<typeof moveEntries.mutateAsync>> | undefined,
      Awaited<ReturnType<typeof bulkAddEntries.mutateAsync>> | undefined,
    ];
    try {
      results = await Promise.all([movePromise, addPromise]);
    } catch {
      return;
    }

    const [moveResult, addResult] = results;
    const count = (moveResult?.moved ?? 0) + (addResult ? addResult.added + addResult.updated : 0);
    toast.success(
      moveMode === "copy"
        ? m.lists_toast_copied_to_list({ count, list: toList.name })
        : m.lists_toast_moved_to_list({ count, list: toList.name }),
    );
    clearSelection();
    setMoveOpen(false);
  };

  const handleBulkMove = (toList: ListResponse, resolution: MoveResolution | null) => {
    void runBulkMove(toList, resolution);
  };

  const handleBulkRemove = () => {
    const count = actionRowIds.length;
    bulkRemove.mutate(
      { listId, entryIds: actionRowIds },
      {
        onSuccess: () => {
          toast.success(`Removed ${count} card${count === 1 ? "" : "s"} from list`);
          clearSelection();
          setRemoveOpen(false);
        },
      },
    );
  };

  const handleTakeOffKeep = () => {
    const count = actionRowIds.length;
    bulkRemove.mutate(
      { listId, entryIds: actionRowIds },
      {
        onSuccess: () => {
          toast.success(`Removed ${count} card${count === 1 ? "" : "s"} from list`);
          clearSelection();
          setTakeOffOpen(false);
        },
      },
    );
  };

  const handleTakeOffSold = () => {
    const count = takeOffCopyIds.length;
    disposeCopies.mutate(
      { copyIds: takeOffCopyIds },
      {
        onSuccess: () => {
          toast.success(`Marked ${count} card${count === 1 ? "" : "s"} as sold`);
          clearSelection();
          setTakeOffOpen(false);
          // Dispose cascades its list-entry deletes server-side; refetch to drop them from view.
          if (userId) {
            void queryClient.invalidateQueries({
              queryKey: listsKeys.detail(userId, listId),
            });
            void queryClient.invalidateQueries({ queryKey: listsKeys.all(userId) });
          }
        },
      },
    );
  };

  useRowActionHandlers("list", {
    onRowClick: handleCardClick,
    onSiblingClick: handleSiblingClick,
    onIncrement: handleIncrement,
    onDecrement: handleDecrement,
    onItemClick: (itemId, printing, modifiers) => {
      if (mode === "browse") {
        handleCardClick(printing);
        return;
      }
      const entry = entryByItemId.get(itemId);
      if (!entry) {
        return;
      }
      if (modifiers.shift) {
        shiftSelectRange(itemId);
      } else {
        toggleSelect(entrySelectionId(itemId, entry));
        setLastSelectedItemId(itemId);
      }
    },
    onItemToggle: (itemId) => {
      const entry = entryByItemId.get(itemId);
      if (!entry) {
        return;
      }
      toggleSelect(entrySelectionId(itemId, entry));
      setLastSelectedItemId(itemId);
    },
    onListBulkAction: (selectionId, action) => {
      openListAction(action, narrowToSelection(selectionId));
    },
    onEntryQuantityChange: (entryId, quantity) => {
      // Defensive: the cell already disables the button when there's no entry.
      if (!entryId) {
        return;
      }
      onQuantityChange(entryId, quantity);
    },
    onRemoveEntry: (entryId, cardName) => onRemoveEntry(entryId, cardName),
    onSetPreference: (selectionId) =>
      setPrefDialogEntryIds(narrowToSelection(selectionId).filter((id) => !isRuleSelectionId(id))),
    onMoveCopyToCollection: handleMoveCopyToCollection,
    onAddEntryToCollection: (selectionId) => setAddToCollectionIds(narrowToSelection(selectionId)),
    onExcludeFromRule: handleExcludeFromRule,
    isQuantityPendingFor: (entryId) => isQuantityPendingFor(entryId),
  });

  const moveTargetLists = allLists.filter((list) => list.id !== listId);

  return {
    mode,
    selected,
    clearSelection,
    enterSelectMode,
    exitSelectMode,
    selectAll,
    isAllSelected,
    hasSelectableEntries: selectableIds.length > 0,
    selectionHasRuleEntry: hasRuleSelection(selected),
    moveOpen,
    setMoveOpen,
    moveMode,
    moveSubject,
    handleBulkMove,
    moveEntries,
    movePending: moveEntries.isPending || bulkAddEntries.isPending,
    removeOpen,
    setRemoveOpen,
    handleBulkRemove,
    actionEntryIds,
    bulkRemove,
    takeOffOpen,
    setTakeOffOpen,
    handleTakeOffKeep,
    handleTakeOffSold,
    disposeCopies,
    takeOffMemberships,
    takeOffReservedCount,
    moveToCollectionOpen,
    setMoveToCollectionOpen,
    moveCopyIds,
    addToCollectionRequest,
    openAddToCollection: setAddToCollectionIds,
    closeAddToCollection,
    openListAction,
    handleSearchAndClose,
    moveTargetLists,
    selectedCard,
    gridSelectedId,
  };
}
