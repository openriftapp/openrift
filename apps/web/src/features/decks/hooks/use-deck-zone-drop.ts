import { useDndContext, useDroppable } from "@dnd-kit/core";
import { formatHasSideboard } from "@openrift/shared/deck-rules";
import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";

import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { isCardAllowedInZone, isDeckZoneFullForDrag } from "@/features/decks/lib/deck-builder-card";
import type { AnyDragData, DeckDropData } from "@/features/decks/lib/deck-dnd-data";
import { DECK_DRAG_TYPES, resolveDraggedCard } from "@/features/decks/lib/deck-dnd-data";
import { useWorkbenchStore } from "@/features/decks/stores/workbench-store";
import { asDragData } from "@/lib/dnd-data";

export function isZoneDropRejected(args: {
  dragData: AnyDragData | undefined;
  zone: DeckZone;
  allCards: DeckBuilderCard[];
  format: DeckFormat;
  relaxed?: boolean;
}): boolean {
  const { dragData, zone, allCards, format, relaxed } = args;
  const draggedCard = resolveDraggedCard(dragData, allCards);
  if (draggedCard === undefined) {
    return false;
  }
  if (!isCardAllowedInZone(draggedCard, zone)) {
    return true;
  }
  const fromZone = dragData?.type === "deck-card" ? dragData.fromZone : null;
  if (relaxed) {
    return (
      zone === WellKnown.deckZone.SIDEBOARD &&
      !formatHasSideboard(format) &&
      fromZone !== WellKnown.deckZone.SIDEBOARD
    );
  }
  return isDeckZoneFullForDrag({ zone, draggedCard, fromZone, allCards, format });
}

/** Never disables the droppable for a rejected drag: that drops out of collision
 * detection, so a release over it removes the card as a drop outside any zone. */
export function useDeckZoneDrop(args: {
  id: string;
  zone: DeckZone;
  allCards: DeckBuilderCard[];
  format: DeckFormat;
  disabled?: boolean;
}): {
  dropRef: (element: HTMLElement | null) => void;
  isOver: boolean;
  dropDisabled: boolean;
} {
  const { id, zone, allCards, format, disabled } = args;
  const { active } = useDndContext();
  const relaxed = useWorkbenchStore((state) => state.relaxed);
  const dragData = asDragData<AnyDragData>(active?.data.current, DECK_DRAG_TYPES);
  const dropDisabled = isZoneDropRejected({ dragData, zone, allCards, format, relaxed });
  const dropData: DeckDropData = { type: "deck-zone", zone, disabled: dropDisabled };
  const { setNodeRef, isOver } = useDroppable({ id, data: dropData, disabled });
  return { dropRef: setNodeRef, isOver, dropDisabled };
}
