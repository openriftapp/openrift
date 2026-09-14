import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";

import type { RuleEntryRef } from "@/features/lists/lib/list-move";

export interface CardDragData {
  type: "collection-card";
  copyIds: string[];
  fromSelection: boolean;
  isStackDrag: boolean;
  printing: Printing;
  previewPrintings: Printing[];
  sourceCollectionId: string | undefined;
  sourceAllGroupCopies: boolean;
}

/**
 * `copyIds` is empty unless the source list is copy-kind; a non-empty one lets
 * the entry move to a collection.
 */
export interface ListEntryDragData {
  type: "list-entry";
  /** Empty for a rule-derived entry, which carries `ruleEntry` instead and only ever copies. */
  entryIds: string[];
  ruleEntry?: RuleEntryRef;
  copyIds: string[];
  sourceListId: string;
  sourceKind: ListKind;
  sourceIntent: ListIntent;
  totalQuantity: number;
  printing: Printing;
  cardName: string;
}

/**
 * Tagged on a sidebar row's `useSortable` so `handleDragEnd` skips it; reorder
 * is handled locally via `useDndMonitor` inside `CollectionSidebar`.
 */
export interface SidebarReorderCollectionDragData {
  type: "sidebar-reorder-collection";
  collectionId: string;
}

export interface SidebarReorderListDragData {
  type: "sidebar-reorder-list";
  listId: string;
  intent: ListIntent;
}

export type AnyDragData =
  | CardDragData
  | ListEntryDragData
  | SidebarReorderCollectionDragData
  | SidebarReorderListDragData;

/**
 * Every drag type this surface owns, for narrowing a payload with
 * {@link asDragData}. The sidebar's own sortable rows produce payloads outside this list.
 */
export const COLLECTION_DRAG_TYPES = [
  "collection-card",
  "list-entry",
  "sidebar-reorder-collection",
  "sidebar-reorder-list",
] as const satisfies readonly AnyDragData["type"][];

/** The drags that carry cards, as opposed to the ones that reorder the sidebar. */
export const CARD_CARRYING_DRAG_TYPES = [
  "collection-card",
  "list-entry",
] as const satisfies readonly AnyDragData["type"][];

/** The sidebar's own reorder drags, which every card drop target stands down for. */
export const SIDEBAR_REORDER_DRAG_TYPES = [
  "sidebar-reorder-collection",
  "sidebar-reorder-list",
] as const satisfies readonly AnyDragData["type"][];
