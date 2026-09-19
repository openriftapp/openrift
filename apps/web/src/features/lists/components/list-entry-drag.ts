import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import { useGridSelectionStore } from "@/features/cards/stores/grid-selection-store";
import type { ListEntryDragData } from "@/features/collections/components/dnd-types";
import type { SelectionParts } from "@/features/lists/lib/list-entry-selection";
import {
  listSelectionSubjects,
  orderedSelectedEntryIds,
  selectionDragFields,
  splitSelectionParts,
} from "@/features/lists/lib/list-entry-selection";
import type { AddEntryToCollectionSubject } from "@/features/lists/lib/list-move";
import { useListEntriesStore } from "@/features/lists/stores/list-entries-store";

/**
 * Widens a drag that started on a selected tile to the whole selection. The
 * payload is frozen at drag start, so a selection of one resolves to itself.
 */
export function resolveListEntrySelection(
  data: ListEntryDragData,
  selected: ReadonlySet<string>,
  entryByItemId: ReadonlyMap<string, ListEntryDetailResponse>,
  printingByEntryId: ReadonlyMap<string, Printing>,
): ListEntryDragData {
  if (!data.fromSelection) {
    return data;
  }
  const selectionIds = orderedSelectedEntryIds(selected, entryByItemId);
  if (selectionIds.length < 2) {
    return data;
  }
  return {
    ...data,
    selectionIds,
    ruleEntry: undefined,
    ...selectionDragFields(selectionIds, entryByItemId, printingByEntryId),
  };
}

export function resolveListEntryDrag(data: ListEntryDragData): ListEntryDragData {
  const { entryByItemId, printingByEntryId } = useListEntriesStore.getState();
  return resolveListEntrySelection(
    data,
    useGridSelectionStore.getState().selected,
    entryByItemId,
    printingByEntryId,
  );
}

/** A dropped drag's subjects: every selected entry, or just the dragged one. */
export function listDragSubjects(data: ListEntryDragData): AddEntryToCollectionSubject[] {
  if (data.selectionIds.length < 2) {
    return [
      {
        sourceKind: data.sourceKind,
        totalQuantity: data.totalQuantity,
        printing: data.printing,
        cardName: data.cardName,
      },
    ];
  }
  const { entryByItemId, printingByEntryId } = useListEntriesStore.getState();
  return listSelectionSubjects(
    data.selectionIds,
    data.sourceKind,
    entryByItemId,
    printingByEntryId,
  );
}

/** The move/copy split for a dropped drag, resolved against the live grid. */
export function listDragParts(data: ListEntryDragData): SelectionParts {
  if (data.selectionIds.length < 2) {
    return {
      entryIds: data.entryIds,
      ruleSubjects: data.ruleEntry
        ? [
            {
              ruleEntry: data.ruleEntry,
              printing: data.printing,
              totalQuantity: data.totalQuantity,
              cardName: data.cardName,
            },
          ]
        : [],
    };
  }
  const { entryByItemId, printingByEntryId } = useListEntriesStore.getState();
  return splitSelectionParts(data.selectionIds, entryByItemId, printingByEntryId);
}
