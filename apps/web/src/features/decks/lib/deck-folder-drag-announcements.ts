import type { Announcements } from "@dnd-kit/core";

import { asDragData } from "@/lib/dnd-data";
import { dragAnnouncements } from "@/lib/drag-announcements";

/** Doubles as the drop payload: `useSortable` hands one `data` object to both halves of a row. */
export interface DeckFolderDragData {
  type: "deck-folder";
  name: string;
}

function folderName(data: unknown): string | undefined {
  return asDragData<DeckFolderDragData>(data, ["deck-folder"])?.name;
}

/** Names the folder being reordered and the folder it moves over. */
export const deckFolderDragAnnouncements: Announcements = dragAnnouncements({
  item: (active) => folderName(active.data.current),
  target: (over) => folderName(over.data.current),
});
