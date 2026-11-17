import type { Activators, CollisionDetection, KeyboardSensorOptions } from "@dnd-kit/core";
import { closestCenter, KeyboardSensor, pointerWithin } from "@dnd-kit/core";

import type {
  CollectionDragData,
  SidebarReorderCollectionDragData,
  SidebarReorderListDragData,
} from "@/features/collections/lib/dnd-types";
import { SIDEBAR_REORDER_DRAG_TYPES } from "@/features/collections/lib/dnd-types";
import { asDragData } from "@/lib/dnd-data";

const sidebarReorderActivators: Activators<KeyboardSensorOptions> = KeyboardSensor.activators.map(
  ({ eventName, handler }) => ({
    eventName,
    handler: (event, options, context) =>
      asDragData<CollectionDragData>(context.active.data.current, SIDEBAR_REORDER_DRAG_TYPES) !==
        undefined && handler(event, options, context),
  }),
);

/**
 * Keyboard drags only for the sidebar's reorder grips. Card tiles spread their listeners
 * without an activator node, so Space or Enter on a tile's buttons would start a drag.
 */
export class SidebarReorderKeyboardSensor extends KeyboardSensor {
  static activators = sidebarReorderActivators;
}

/** A keyboard drag has no pointer, so it lands on the closest droppable. */
export const collectionCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);

/** A sidebar row takes a reorder drop only from its own section: collections, or lists of one intent. */
export function acceptsReorderDrop(
  row: SidebarReorderCollectionDragData | SidebarReorderListDragData,
  activeData: unknown,
): boolean {
  const active = asDragData<CollectionDragData>(activeData, SIDEBAR_REORDER_DRAG_TYPES);
  if (active?.type === "sidebar-reorder-list") {
    return row.type === "sidebar-reorder-list" && row.intent === active.intent;
  }
  return active?.type === row.type;
}
