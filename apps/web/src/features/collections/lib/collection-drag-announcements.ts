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
import { m } from "@/paraglide/messages.js";

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

function itemName(active: Active): string {
  const drag = asDragData<CollectionDragData>(active.data.current, COLLECTION_DRAG_TYPES);
  if (drag === undefined) {
    return m.collections_drag_announce_unnamed();
  }
  if (drag.type === "collection-card") {
    return legendDisplayName(drag.printing.card);
  }
  if (drag.type === "list-entry") {
    return drag.cardName;
  }
  return drag.label;
}

function targetName(over: Over | null): string | undefined {
  const drop = asDragData<NamedDropData>(over?.data.current, NAMED_DROP_TYPES);
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
export const collectionDragAnnouncements: Announcements = {
  onDragStart: ({ active }) => m.collections_drag_announce_picked_up({ name: itemName(active) }),
  onDragOver: ({ active, over }) => {
    const name = itemName(active);
    const target = targetName(over);
    return target === undefined
      ? m.collections_drag_announce_not_over({ name })
      : m.collections_drag_announce_over({ name, target });
  },
  onDragEnd: ({ active, over }) => {
    const name = itemName(active);
    const target = targetName(over);
    return target === undefined
      ? m.collections_drag_announce_nothing_moved({ name })
      : m.collections_drag_announce_dropped({ name, target });
  },
  onDragCancel: ({ active }) =>
    m.collections_drag_announce_nothing_moved({ name: itemName(active) }),
};
