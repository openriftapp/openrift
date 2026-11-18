import type { Announcements } from "@dnd-kit/core";
import type { BoardStep } from "@openrift/shared/board-state";

import type {
  ArrowDragData,
  ChainDropData,
  NewPieceDragData,
  PieceDragData,
  PieceDropData,
  ZoneDropData,
} from "@/features/board-states/lib/board-editor-drag";
import {
  chainEntryLabel,
  describeArrowEnd,
  describeZone,
  pieceKindLabel,
  pieceName,
} from "@/features/board-states/lib/board-labels";
import { asDragData } from "@/lib/dnd-data";
import { dragAnnouncements } from "@/lib/drag-announcements";
import { m } from "@/paraglide/messages.js";

type BoardDragData = NewPieceDragData | PieceDragData | ArrowDragData;
type BoardDropData = ZoneDropData | PieceDropData | ChainDropData;

const DRAG_TYPES = ["board-new-piece", "board-piece", "board-arrow"] as const;
const DROP_TYPES = ["board-zone", "board-piece-target", "board-chain-target"] as const;

/** Names pieces, arrows, zones and chain entries as the editor labels them; `step` is read at announce time. */
export function boardDragAnnouncements(step: () => BoardStep | undefined): Announcements {
  const pieceById = (pieceId: string) => step()?.pieces.find((piece) => piece.id === pieceId);
  return dragAnnouncements({
    item: (active) => {
      const drag = asDragData<BoardDragData>(active.data.current, DRAG_TYPES);
      if (drag === undefined) {
        return;
      }
      if (drag.type === "board-new-piece") {
        return drag.card?.name ?? pieceKindLabel(drag.kind);
      }
      if (drag.type === "board-piece") {
        const piece = pieceById(drag.pieceId);
        return piece ? pieceName(piece) : undefined;
      }
      const current = step();
      return current
        ? m.board_states_drag_arrow({ name: describeArrowEnd(drag.from, current) })
        : undefined;
    },
    target: (over, active) => {
      const drop = asDragData<BoardDropData>(over.data.current, DROP_TYPES);
      if (drop === undefined) {
        return;
      }
      if (drop.type === "board-zone") {
        return describeZone(drop.zone, drop.owner);
      }
      // Only an arrow ends on a piece or a chain entry; a piece lands in a zone.
      if (asDragData<BoardDragData>(active.data.current, DRAG_TYPES)?.type !== "board-arrow") {
        return;
      }
      if (drop.type === "board-piece-target") {
        const piece = pieceById(drop.pieceId);
        return piece ? pieceName(piece) : undefined;
      }
      const current = step();
      const entry = current?.chain.find((candidate) => candidate.id === drop.entryId);
      return current && entry ? chainEntryLabel(entry, current.pieces) : undefined;
    },
  });
}
