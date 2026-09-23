import type {
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import type { Card } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

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

export type SeatSlot =
  | { kind: "zone"; zone: PlayerZoneKind }
  | { kind: "stack"; stack: "runeDeck" | "deck" };

const SEAT_ORDER: readonly SeatSlot[] = [
  { kind: "stack", stack: "runeDeck" },
  { kind: "zone", zone: "runes" },
  { kind: "zone", zone: "champion" },
  { kind: "zone", zone: "legend" },
  { kind: "zone", zone: "base" },
  { kind: "stack", stack: "deck" },
  { kind: "zone", zone: "trash" },
];

/** Table order for the viewer's seat, left to right. A mirrored seat renders it rotated. */
export function seatSlots(zones: BoardZoneVisibility): SeatSlot[] {
  return SEAT_ORDER.filter((slot) => (slot.kind === "stack" ? zones.deck : zones[slot.zone]));
}

export function slotKey(slot: SeatSlot): string {
  return slot.kind === "zone" ? `zone:${slot.zone}` : `stack:${slot.stack}`;
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

export interface ZoneCardRule {
  cardFilter: (card: Pick<Card, "types" | "superTypes">) => boolean;
  kinds: readonly PieceKind[];
  /** The zone's add slot disappears at this count; the rail can still place more. */
  capacity: number;
}

const CHAMPION = WellKnown.superType.CHAMPION;

/** What a zone's own add panel offers. The side rail stays unrestricted for custom formats. */
export function zoneCardRule(zone: BoardZoneRef): ZoneCardRule | null {
  switch (zone.kind) {
    case "runes": {
      return { cardFilter: (card) => card.types.includes("rune"), kinds: ["rune"], capacity: 12 };
    }
    case "legend": {
      return {
        cardFilter: (card) => card.types.includes("legend"),
        kinds: ["legend"],
        capacity: 1,
      };
    }
    case "champion": {
      return {
        cardFilter: (card) => card.types.includes("unit") && card.superTypes.includes(CHAMPION),
        kinds: ["unit"],
        capacity: 1,
      };
    }
    case "battlefield": {
      return {
        cardFilter: (card) => card.types.includes("unit"),
        kinds: ["unit", "token"],
        capacity: Number.POSITIVE_INFINITY,
      };
    }
    default: {
      return null;
    }
  }
}

/** The zone's own add slot hides once the zone holds its usual complement. */
export function zoneAcceptsMore(zone: BoardZoneRef, count: number, extraCapacity = 0): boolean {
  const rule = zoneCardRule(zone);
  return rule === null || count < rule.capacity + extraCapacity;
}

/** Each granting card adds one legend to the Legend Zone while it is on the board. */
export function grantedLegendSlots(
  pieces: readonly BoardPiece[],
  owner: BoardPlayer,
  grantsLegends: (cardId: string) => boolean,
): number {
  return pieces.filter(
    (piece) =>
      piece.owner === owner &&
      (piece.zone.kind === "base" || piece.zone.kind === "battlefield") &&
      piece.card !== null &&
      grantsLegends(piece.card.cardId),
  ).length;
}

export function nextPieceId(pieces: readonly BoardPiece[]): string {
  const used = new Set(pieces.map((piece) => piece.id));
  let n = 1;
  while (used.has(`p${n}`)) {
    n++;
  }
  return `p${n}`;
}

/** Numerals for pieces whose display name is shared by another piece in the step, 1-based in piece order. Runes are never numbered. */
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
