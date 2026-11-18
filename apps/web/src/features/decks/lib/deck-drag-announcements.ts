import type { Announcements } from "@dnd-kit/core";
import { legendDisplayName } from "@openrift/shared/card-name";
import { enumLabel } from "@openrift/shared/enum-label";
import type { LabelMap } from "@openrift/shared/enum-label";

import type { DeckDragData, DeckDropData } from "@/features/decks/lib/deck-dnd-data";
import {
  DECK_DRAG_TYPES,
  DECK_DROP_TYPES,
  isDropRejected,
} from "@/features/decks/lib/deck-dnd-data";
import { asDragData } from "@/lib/dnd-data";
import { dragAnnouncements } from "@/lib/drag-announcements";

/** Names the dragged card and the deck zone it would land in; a zone that refuses it is no target. */
export function deckDragAnnouncements(zoneLabels: LabelMap): Announcements {
  return dragAnnouncements({
    item: (active) => {
      const drag = asDragData<DeckDragData>(active.data.current, DECK_DRAG_TYPES);
      if (drag === undefined) {
        return;
      }
      if (drag.type === "deck-card") {
        return drag.cardName;
      }
      const { card } = drag;
      return legendDisplayName({ name: card.cardName, types: card.cardTypes, tags: card.tags });
    },
    target: (over, active) => {
      const drop = asDragData<DeckDropData>(over.data.current, DECK_DROP_TYPES);
      const drag = asDragData<DeckDragData>(active.data.current, DECK_DRAG_TYPES);
      if (drop === undefined || drag === undefined || isDropRejected(drag, drop)) {
        return;
      }
      return enumLabel(zoneLabels, drop.zone);
    },
  });
}
