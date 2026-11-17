import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { SidebarReorderKeyboardSensor } from "@/features/collections/lib/collection-dnd-sensing";

const DRAG_ACTIVATION = { distance: 8 };

export function useCollectionDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: DRAG_ACTIVATION }),
    useSensor(SidebarReorderKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
