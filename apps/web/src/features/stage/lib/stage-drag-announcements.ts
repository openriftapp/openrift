import type { Announcements } from "@dnd-kit/core";
import { legendDisplayName } from "@openrift/shared/card-name";

import { asStageDragData, asStageDropData } from "@/features/stage/lib/stage-dnd-types";
import { dragAnnouncements } from "@/lib/drag-announcements";
import { m } from "@/paraglide/messages.js";

/** A queued stop only reorders onto another stop; a browser card arrives in the queue or before a stop. */
export const stageDragAnnouncements: Announcements = dragAnnouncements({
  item: (active) => {
    const drag = asStageDragData(active.data.current);
    if (drag === undefined) {
      return;
    }
    return drag.type === "stage-pool-card" ? legendDisplayName(drag.printing.card) : drag.name;
  },
  target: (over, active) => {
    const drag = asStageDragData(active.data.current);
    const drop = asStageDropData(over.data.current);
    if (drag === undefined || drop === undefined) {
      return;
    }
    if (drag.type === "stage-queue-row") {
      return drop.type === "stage-queue-row" ? drop.name : undefined;
    }
    if (drop.type === "stage-queue-slot") {
      return m.stage_queue_drag_before({ name: drop.name });
    }
    return drop.type === "stage-queue" ? m.stage_queue_drag_queue() : undefined;
  },
});
