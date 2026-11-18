import type { Active, Announcements, Over } from "@dnd-kit/core";
import { legendDisplayName } from "@openrift/shared/card-name";

import type {
  CollectionDragData,
  CollectionDropData,
  SidebarReorderCollectionDragData,
  SidebarReorderListDragData,
} from "@/features/collections/lib/dnd-types";
import { COLLECTION_DRAG_TYPES } from "@/features/collections/lib/dnd-types";
import { asDragData } from "@/lib/dnd-data";
import { dragAnnouncements } from "@/lib/drag-announcements";

interface ListDropName {
  type: "list";
  listName: string;
}

type NamedDropData =
  | CollectionDropData
  | ListDropName
  | SidebarReorderCollectionDragData
  | SidebarReorderListDragData;

const NAMED_DROP_TYPES = [
  "collection",
  "list",
  "sidebar-reorder-collection",
  "sidebar-reorder-list",
] as const satisfies readonly NamedDropData["type"][];

function itemName(active: Active): string | undefined {
  const drag = asDragData<CollectionDragData>(active.data.current, COLLECTION_DRAG_TYPES);
  if (drag === undefined) {
    return undefined;
  }
  if (drag.type === "collection-card" || drag.type === "list-entry") {
    return legendDisplayName(drag.printing.card);
  }
  return drag.label;
}

function targetName(over: Over): string | undefined {
  const drop = asDragData<NamedDropData>(over.data.current, NAMED_DROP_TYPES);
  if (drop === undefined) {
    return undefined;
  }
  if (drop.type === "collection") {
    return drop.collectionName;
  }
  if (drop.type === "list") {
    return drop.listName;
  }
  return drop.label;
}

/** Screen-reader announcements for the collections layout, by card, collection and list name. */
export const collectionDragAnnouncements: Announcements = dragAnnouncements({
  item: itemName,
  target: targetName,
});
