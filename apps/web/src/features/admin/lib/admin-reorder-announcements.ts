import type { Announcements } from "@dnd-kit/core";

import type { DragAnnouncementText } from "@/lib/drag-announcements";
import { dragAnnouncements } from "@/lib/drag-announcements";

const ADMIN_TEXT: DragAnnouncementText = {
  pickedUp: (name) => `Picked up ${name}.`,
  over: (name, target) => `${name} is over ${target}.`,
  notOver: (name) => `${name} is not over another row.`,
  backInPlace: (name) => `${name} is back in its place.`,
  dropped: (name, target) => `Dropped ${name} on ${target}.`,
  nothingMoved: (name) => `Dropped ${name}. Nothing moved.`,
  unnamed: () => "Row",
};

/** Names a reordered admin row and the row it moves over, by the label the table shows. */
export function adminReorderAnnouncements(
  rowLabel: (key: string) => string | undefined,
): Announcements {
  return dragAnnouncements(
    { item: (active) => rowLabel(String(active.id)), target: (over) => rowLabel(String(over.id)) },
    ADMIN_TEXT,
  );
}
