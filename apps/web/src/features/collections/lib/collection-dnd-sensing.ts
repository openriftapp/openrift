import type { Activators, CollisionDetection, KeyboardSensorOptions } from "@dnd-kit/core";
import { closestCenter, KeyboardSensor, pointerWithin } from "@dnd-kit/core";
import { clamp } from "@openrift/shared/math";

import type {
  CollectionDragData,
  SidebarReorderCollectionDragData,
  SidebarReorderListDragData,
} from "@/features/collections/lib/dnd-types";
import { SIDEBAR_REORDER_DRAG_TYPES } from "@/features/collections/lib/dnd-types";
import { asDragData } from "@/lib/dnd-data";
import type { KeyboardDragMove } from "@/lib/keyboard-drag-sensor";
import { NonScrollingKeyboardSensor } from "@/lib/keyboard-drag-sensor";

const sidebarReorderActivators: Activators<KeyboardSensorOptions> = KeyboardSensor.activators.map(
  ({ eventName, handler }) => ({
    eventName,
    handler: (event, options, context) =>
      asDragData<CollectionDragData>(context.active.data.current, SIDEBAR_REORDER_DRAG_TYPES) !==
        undefined && handler(event, options, context),
  }),
);

/**
 * Reorder grips only: card tiles have no activator node. Scrolls the first scroll area other
 * than the page that the moved row leaves; the sticky sidebar's rows stay put on a page scroll.
 */
export class SidebarReorderKeyboardSensor extends NonScrollingKeyboardSensor {
  static activators = sidebarReorderActivators;

  protected override scrollForMove({ areas, page, top, bottom, deltaY }: KeyboardDragMove): number {
    for (const area of areas) {
      if (area === page) {
        continue;
      }
      const box = area.getBoundingClientRect();
      let overflow = 0;
      if (deltaY > 0 && bottom > box.bottom) {
        overflow = bottom - box.bottom;
      } else if (deltaY < 0 && top < box.top) {
        overflow = top - box.top;
      }
      const by = clamp(
        overflow,
        -area.scrollTop,
        area.scrollHeight - area.clientHeight - area.scrollTop,
      );
      if (by !== 0) {
        area.scrollBy({ top: by });
        return by;
      }
    }
    return 0;
  }
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
