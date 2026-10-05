import type { BoardCardRef, BoardPlayer, PieceKind } from "@openrift/shared/board-state";

export interface NewPieceDragData {
  type: "board-new-piece";
  owner: BoardPlayer;
  kind: PieceKind;
  card: BoardCardRef | null;
}
