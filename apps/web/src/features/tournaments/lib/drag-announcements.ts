import type { Active, Announcements, Over } from "@dnd-kit/core";

import { m } from "@/paraglide/messages.js";

export interface DragAnnouncementLabels {
  itemName: (active: unknown) => string | undefined;
  targetName: (over: unknown, active: unknown) => string | undefined;
  dropped: (name: string, target: string) => string;
}

export function dragAnnouncements(labels: DragAnnouncementLabels): Announcements {
  const nameOf = (active: Active) =>
    labels.itemName(active.data.current) ?? m.tournaments_pairing_editor_unknown_player();
  const targetOf = (active: Active, over: Over | null) =>
    over === null ? undefined : labels.targetName(over.data.current, active.data.current);

  return {
    onDragStart: ({ active }) =>
      m.tournaments_pairing_editor_drag_picked_up({ name: nameOf(active) }),
    onDragOver: ({ active, over }) => {
      const name = nameOf(active);
      const target = targetOf(active, over);
      return target === undefined
        ? m.tournaments_pairing_editor_drag_not_over({ name })
        : m.tournaments_pairing_editor_drag_over({ name, target });
    },
    onDragEnd: ({ active, over }) => {
      const name = nameOf(active);
      const target = targetOf(active, over);
      return target === undefined
        ? m.tournaments_pairing_editor_drag_nothing_moved({ name })
        : labels.dropped(name, target);
    },
    onDragCancel: ({ active }) =>
      m.tournaments_pairing_editor_drag_nothing_moved({ name: nameOf(active) }),
  };
}
