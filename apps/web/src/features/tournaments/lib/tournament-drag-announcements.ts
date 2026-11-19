import type { Announcements } from "@dnd-kit/core";

import type { DragAnnouncementNames } from "@/lib/drag-announcements";
import { DRAG_ANNOUNCEMENT_TEXT, dragAnnouncements } from "@/lib/drag-announcements";
import { m } from "@/paraglide/messages.js";

/** Names players and seats; `dropped` says what the drop did to the pairing. */
export function tournamentDragAnnouncements(
  names: DragAnnouncementNames,
  dropped: (name: string, target: string) => string,
): Announcements {
  return dragAnnouncements(names, {
    ...DRAG_ANNOUNCEMENT_TEXT,
    dropped,
    unnamed: () => m.tournaments_pairing_editor_unknown_player(),
  });
}
