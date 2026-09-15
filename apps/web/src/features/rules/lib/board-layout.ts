import type {
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  PlayerZoneKind,
} from "@openrift/shared/board-state";

export interface BoardSeats {
  top: BoardPlayer[];
  bottom: BoardPlayer[];
}

export function seatsFor(playerCount: number): BoardSeats {
  if (playerCount >= 4) {
    return { top: ["B", "D"], bottom: ["A", "C"] };
  }
  if (playerCount === 3) {
    return { top: ["B"], bottom: ["A", "C"] };
  }
  return { top: ["B"], bottom: ["A"] };
}

const NEAR_ROW: readonly PlayerZoneKind[] = ["legend", "champion", "base"];
const FAR_ROW: readonly PlayerZoneKind[] = ["runes", "hand", "trash"];

export interface ZoneSlot {
  kind: PlayerZoneKind;
  visible: boolean;
}

/** Fixed slot order per row, so a hidden zone never shifts the others sideways. */
export function playerRows(zones: BoardZoneVisibility): { near: ZoneSlot[]; far: ZoneSlot[] } {
  const slot = (kind: PlayerZoneKind) => ({ kind, visible: zones[kind] });
  return { near: NEAR_ROW.map((kind) => slot(kind)), far: FAR_ROW.map((kind) => slot(kind)) };
}

export function rowIsVisible(row: readonly ZoneSlot[]): boolean {
  return row.some((slot) => slot.visible);
}

export function sameZone(a: BoardZoneRef, b: BoardZoneRef): boolean {
  if (a.kind === "battlefield" && b.kind === "battlefield") {
    return a.index === b.index;
  }
  return a.kind === b.kind;
}

export function arrowZoneKey(zone: BoardZoneRef, owner: BoardPlayer): string {
  return zone.kind === "battlefield"
    ? `battlefield-${zone.index}-${owner}`
    : `${zone.kind}-${owner}`;
}

export function piecesAt(step: BoardStep, zone: BoardZoneRef, owner?: BoardPlayer): BoardPiece[] {
  return step.pieces.filter(
    (piece) => sameZone(piece.zone, zone) && (owner === undefined || piece.owner === owner),
  );
}

const PIECE_KIND_BY_CARD_TYPE: Record<string, PieceKind> = {
  unit: "unit",
  spell: "spell",
  gear: "gear",
  rune: "rune",
  legend: "legend",
};

export function pieceKindForCardTypes(types: readonly string[]): PieceKind {
  for (const type of types) {
    const kind = PIECE_KIND_BY_CARD_TYPE[type];
    if (kind) {
      return kind;
    }
  }
  return "token";
}

export function nextPieceId(pieces: readonly BoardPiece[]): string {
  const used = new Set(pieces.map((piece) => piece.id));
  let n = 1;
  while (used.has(`p${n}`)) {
    n++;
  }
  return `p${n}`;
}
