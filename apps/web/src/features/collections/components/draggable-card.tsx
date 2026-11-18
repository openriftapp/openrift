import { useDraggable } from "@dnd-kit/core";
import type { Printing } from "@openrift/shared/types/catalog";
import type { ReactNode } from "react";

import type { CardDragData } from "@/features/collections/lib/dnd-types";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface DraggableCardProps {
  id: string;
  copyIds: string[];
  fromSelection: boolean;
  isStackDrag: boolean;
  printing: Printing;
  previewPrintings: Printing[];
  sourceCollectionId: string | undefined;
  sourceAllGroupCopies: boolean;
  children?: ReactNode;
}

/** A pointer-only drag: the keyboard sensor starts no card drag, so the wrapper takes no tab stop. */
export function DraggableCard({
  id,
  copyIds,
  fromSelection,
  isStackDrag,
  printing,
  previewPrintings,
  sourceCollectionId,
  sourceAllGroupCopies,
  children,
}: DraggableCardProps) {
  const isMobile = useIsMobile();

  const data: CardDragData = {
    type: "collection-card",
    copyIds,
    fromSelection,
    isStackDrag,
    printing,
    previewPrintings,
    sourceCollectionId,
    sourceAllGroupCopies,
  };

  const { setNodeRef, listeners, isDragging } = useDraggable({ id, data });

  if (isMobile) {
    return children;
  }

  return (
    <div ref={setNodeRef} {...listeners} style={isDragging ? { opacity: 0.4 } : undefined}>
      {children}
    </div>
  );
}
