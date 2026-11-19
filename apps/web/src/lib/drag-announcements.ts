import type { Active, Announcements, Over } from "@dnd-kit/core";

import { m } from "@/paraglide/messages.js";

export interface DragAnnouncementText {
  pickedUp: (name: string) => string;
  over: (name: string, target: string) => string;
  notOver: (name: string) => string;
  backInPlace: (name: string) => string;
  dropped: (name: string, target: string) => string;
  nothingMoved: (name: string) => string;
  unnamed: () => string;
}

const DRAG_ANNOUNCEMENT_TEXT: DragAnnouncementText = {
  pickedUp: (name) => m.drag_announce_picked_up({ name }),
  over: (name, target) => m.drag_announce_over({ name, target }),
  notOver: (name) => m.drag_announce_not_over({ name }),
  backInPlace: (name) => m.drag_announce_back_in_place({ name }),
  dropped: (name, target) => m.drag_announce_dropped({ name, target }),
  nothingMoved: (name) => m.drag_announce_nothing_moved({ name }),
  unnamed: () => m.drag_announce_unnamed(),
};

/** Names in user language; `target` is undefined where the drag cannot land. */
export interface DragAnnouncementNames {
  item: (active: Active) => string | undefined;
  target: (over: Over, active: Active) => string | undefined;
}

// One pointer or keyboard drives one drag at a time, so one flag serves every context.
let reachedTarget = false;

/** A sortable item reports its own slot as `over`; that is no target. */
function isOwnSlot(active: Active, over: Over | null): over is Over {
  return over !== null && over.id === active.id;
}

/** Screen-reader announcements that name the dragged thing and its target. */
export function dragAnnouncements(
  names: DragAnnouncementNames,
  text: DragAnnouncementText = DRAG_ANNOUNCEMENT_TEXT,
): Announcements {
  const nameOf = (active: Active) => names.item(active) ?? text.unnamed();
  const targetOf = (active: Active, over: Over | null) =>
    over === null || isOwnSlot(active, over) ? undefined : names.target(over, active);

  return {
    onDragStart: ({ active }) => {
      reachedTarget = false;
      return text.pickedUp(nameOf(active));
    },
    onDragOver: ({ active, over }) => {
      const name = nameOf(active);
      // Until the drag reaches a target, where it started is no news: "Picked up" stays.
      if (isOwnSlot(active, over)) {
        return reachedTarget ? text.backInPlace(name) : undefined;
      }
      const target = targetOf(active, over);
      if (target === undefined) {
        return reachedTarget ? text.notOver(name) : undefined;
      }
      reachedTarget = true;
      return text.over(name, target);
    },
    onDragEnd: ({ active, over }) => {
      const name = nameOf(active);
      const target = targetOf(active, over);
      return target === undefined ? text.nothingMoved(name) : text.dropped(name, target);
    },
    onDragCancel: ({ active }) => text.nothingMoved(nameOf(active)),
  };
}
