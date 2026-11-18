import type {
  BoardArrow,
  BoardCardRef,
  BoardPlayer,
  BoardZoneRef,
  PieceKind,
} from "@openrift/shared/board-state";

export interface NewPieceDragData {
  type: "board-new-piece";
  owner: BoardPlayer;
  kind: PieceKind;
  card: BoardCardRef | null;
}

export interface PieceDragData {
  type: "board-piece";
  pieceId: string;
}

export interface ArrowDragData {
  type: "board-arrow";
  from: BoardArrow["from"];
}

export interface PieceDropData {
  type: "board-piece-target";
  pieceId: string;
}

export interface ChainDropData {
  type: "board-chain-target";
  entryId: string;
}

export interface ZoneDropData {
  type: "board-zone";
  zone: BoardZoneRef;
  owner?: BoardPlayer;
}
