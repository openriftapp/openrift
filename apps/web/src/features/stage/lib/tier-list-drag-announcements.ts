import type { Announcements } from "@dnd-kit/core";

import { asTierListDragData, asTierListDropData } from "@/features/stage/lib/tier-list-dnd-types";
import { dragAnnouncements } from "@/lib/drag-announcements";
import { m } from "@/paraglide/messages.js";

/** Names cards by their display name and rows by their label; a row handle only lands on rows. */
export function tierListDragAnnouncements(names: {
  cardName: (cardId: string) => string | undefined;
  rowLabel: (rowIndex: number) => string | undefined;
}): Announcements {
  const rowName = (rowIndex: number) => {
    const label = names.rowLabel(rowIndex);
    return label === undefined ? undefined : m.tier_lists_drag_row({ label });
  };
  return dragAnnouncements({
    item: (active) => {
      const drag = asTierListDragData(active.data.current);
      if (drag === undefined) {
        return;
      }
      return drag.type === "tier-row-handle" ? rowName(drag.rowIndex) : names.cardName(drag.cardId);
    },
    target: (over, active) => {
      const drag = asTierListDragData(active.data.current);
      const drop = asTierListDropData(over.data.current);
      if (drag === undefined || drop === undefined) {
        return;
      }
      if (drag.type === "tier-row-handle") {
        return drop.type === "tier-row" && drop.rowIndex !== drag.rowIndex
          ? rowName(drop.rowIndex)
          : undefined;
      }
      if (drop.type === "tier-pool") {
        return drag.type === "tier-board-card" ? m.tier_lists_drag_pool() : undefined;
      }
      return rowName(drop.rowIndex);
    },
  });
}
