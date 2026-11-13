import type {
  BoardPiece,
  ChainEntryType,
  BoardPlayer,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  PlayerZoneKind,
} from "./board-state.js";
import { sameZone } from "./board-state.js";

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

export type SeatZone = Exclude<PlayerZoneKind, "hand">;

const SEAT_ORDER: readonly SeatZone[] = [
  "runeDeck",
  "runes",
  "champion",
  "legend",
  "base",
  "deck",
  "trash",
  "banishment",
];

export function seatSlots(zones: BoardZoneVisibility): SeatZone[] {
  return SEAT_ORDER.filter((zone) =>
    zone === "deck" || zone === "runeDeck" ? zones.deck : zones[zone],
  );
}

export function arrowZoneKey(zone: BoardZoneRef, owner: BoardPlayer): string {
  if (zone.kind === "facedown") {
    return `facedown-${zone.index}`;
  }
  return zone.kind === "battlefield"
    ? `battlefield-${zone.index}-${owner}`
    : `${zone.kind}-${owner}`;
}

export function piecesAt(
  step: { readonly pieces: readonly BoardPiece[] },
  zone: BoardZoneRef,
  owner?: BoardPlayer,
): BoardPiece[] {
  return step.pieces.filter(
    (piece) => sameZone(piece.zone, zone) && (owner === undefined || piece.owner === owner),
  );
}

export function occupiedZones(
  steps: readonly { readonly pieces: readonly BoardPiece[] }[],
): Set<string> {
  return new Set(
    steps.flatMap((step) => step.pieces.map((piece) => arrowZoneKey(piece.zone, piece.owner))),
  );
}

export function pieceNumerals(pieces: readonly BoardPiece[]): Map<string, number> {
  const nameOf = (piece: BoardPiece) => piece.card?.name ?? `kind:${piece.kind}`;
  const groups = Map.groupBy(
    pieces.filter((piece) => piece.kind !== "rune"),
    (piece) => nameOf(piece),
  );
  const numerals = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    group.forEach((piece, index) => numerals.set(piece.id, index + 1));
  }
  return numerals;
}

/** The share image has no locale; these match the English board messages. */
export const BOARD_ZONE_LABEL_EN: Record<PlayerZoneKind | "facedown" | "chain", string> = {
  base: "Base",
  legend: "Legend",
  champion: "Champion",
  runes: "Runes",
  hand: "Hand",
  trash: "Trash",
  banishment: "Banishment",
  deck: "Deck",
  runeDeck: "Rune deck",
  facedown: "Facedown",
  chain: "Chain",
};

export const PIECE_KIND_LABEL_EN: Record<PieceKind, string> = {
  unit: "Unit",
  spell: "Spell",
  gear: "Gear",
  rune: "Rune",
  legend: "Legend",
  token: "Token",
};

export const CHAIN_TYPE_LABEL_EN: Record<ChainEntryType, string> = {
  spell: "Spell",
  triggered: "Triggered ability",
  activated: "Activated ability",
};
