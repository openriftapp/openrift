import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { entryAddsCopies } from "@/features/lists/lib/list-move";
import { asDragData } from "@/lib/dnd-data";
import { cn } from "@/lib/utils";

import type { AnyDragData } from "./dnd-types";
import { COLLECTION_DRAG_TYPES } from "./dnd-types";

interface DroppableCollectionProps {
  collectionId: string;
  disabled: boolean;
  children: ReactNode;
}

export function DroppableCollection({
  collectionId,
  disabled,
  children,
}: DroppableCollectionProps) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `collection-${collectionId}`,
    data: { type: "collection", collectionId },
    disabled,
  });

  const dragData = asDragData<AnyDragData>(active?.data.current, COLLECTION_DRAG_TYPES);
  const showHighlight = !disabled && isOver && isCompatibleCollectionDrop(dragData, collectionId);

  return (
    <div
      ref={setNodeRef}
      className={cn(showHighlight && "bg-primary/10 ring-primary/60 rounded-md ring-2 ring-inset")}
    >
      {children}
    </div>
  );
}

/** Mirrors the collection branch of the layout's `handleDragEnd`. */
export function isCompatibleCollectionDrop(
  drag: AnyDragData | undefined,
  collectionId: string,
): boolean {
  if (!drag) {
    return false;
  }
  if (drag.type === "collection-card") {
    return drag.sourceCollectionId !== collectionId;
  }
  if (drag.type !== "list-entry") {
    return false;
  }
  return drag.copyIds.length > 0 || entryAddsCopies(drag.sourceKind);
}
