import type {
  BoardChainEntry,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardTurn,
  BoardZoneRef,
  BoardZoneVisibility,
  PieceKind,
  PlayerZoneKind,
  ScoringMode,
} from "@openrift/shared/board-state";
import { isDeckZone, nextBoardId, PIECE_KINDS, sameZone } from "@openrift/shared/board-state";
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

/** Table order for the viewer's seat, left to right. A mirrored seat renders it rotated. */
export function seatSlots(zones: BoardZoneVisibility): SeatZone[] {
  return SEAT_ORDER.filter((zone) =>
    zone === "deck" || zone === "runeDeck" ? zones.deck : zones[zone],
  );
}

/** A battlefield's facedown zone is shared, so its key carries no owner. */
export function arrowZoneKey(zone: BoardZoneRef, owner: BoardPlayer): string {
  if (zone.kind === "facedown") {
    return `facedown-${zone.index}`;
  }
  return zone.kind === "battlefield"
    ? `battlefield-${zone.index}-${owner}`
    : `${zone.kind}-${owner}`;
}

/** Cards entering these zones turn facedown; cards leaving them turn face up. */
export function isHiddenZone(zone: BoardZoneRef): boolean {
  return zone.kind === "facedown" || isDeckZone(zone);
}

export function hasTurnState(turn: BoardTurn): boolean {
  return Object.values(turn).some((value) => value !== undefined);
}

export function nextChainId(chain: readonly BoardChainEntry[]): string {
  return nextBoardId(
    "c",
    chain.map((entry) => entry.id),
  );
}

/** Teams sit A+C and B+D, so A and B carry the team scores. */
export function scoreHolder(player: BoardPlayer, scoring: ScoringMode): BoardPlayer {
  if (scoring === "players") {
    return player;
  }
  return player === "A" || player === "C" ? "A" : "B";
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
    case "facedown": {
      return { cardFilter: () => true, kinds: PIECE_KINDS, capacity: 1 };
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

export function occupiedZones(steps: readonly BoardStep[]): Set<string> {
  return new Set(
    steps.flatMap((step) => step.pieces.map((piece) => arrowZoneKey(piece.zone, piece.owner))),
  );
}

export function longestChain(steps: readonly BoardStep[]): number {
  return Math.max(0, ...steps.map((step) => step.chain.length));
}

const SLOT_UNITS = { runes: 2.4, base: 3, other: 1.3, empty: 0.9 } as const;
const BATTLEFIELD_CARD_UNITS = 1.6;

export function boardWidthUnits(
  steps: readonly BoardStep[],
  zones: BoardZoneVisibility,
  seats: BoardSeats,
  battlefieldCount: number,
): number {
  const occupied = occupiedZones(steps);
  const side = Math.max(seats.top.length, seats.bottom.length);
  const used = (zone: PlayerZoneKind) =>
    [...seats.top, ...seats.bottom].some((owner) =>
      occupied.has(arrowZoneKey({ kind: zone }, owner)),
    );
  let seatUnits = 0;
  for (const zone of seatSlots(zones)) {
    if (zone === "deck" || zone === "runeDeck") {
      seatUnits += SLOT_UNITS.other;
    } else if (used(zone)) {
      seatUnits += zone === "runes" || zone === "base" ? SLOT_UNITS[zone] : SLOT_UNITS.other;
    } else {
      seatUnits += SLOT_UNITS.empty;
    }
  }
  if (zones.hand) {
    seatUnits += used("hand") ? SLOT_UNITS.base : SLOT_UNITS.empty;
  }
  let battlefieldUnits = 0;
  for (let index = 0; index < battlefieldCount; index++) {
    const zone: BoardZoneRef = { kind: "battlefield", index };
    const crowd = Math.max(
      0,
      ...steps.flatMap((step) =>
        [...seats.top, ...seats.bottom].map((owner) => piecesAt(step, zone, owner).length),
      ),
    );
    battlefieldUnits += Math.max(BATTLEFIELD_CARD_UNITS, (crowd * 1.1 + 0.4) * side);
  }
  return Math.max(seatUnits * side, battlefieldUnits, 1);
}

export function nextPieceId(pieces: readonly BoardPiece[]): string {
  return nextBoardId(
    "p",
    pieces.map((piece) => piece.id),
  );
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
