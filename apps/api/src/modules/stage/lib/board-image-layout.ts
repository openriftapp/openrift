import type { BoardSeats, SeatZone } from "@openrift/shared/board-layout";
import { BOARD_ZONE_LABEL_EN, piecesAt, seatSlots } from "@openrift/shared/board-layout";
import type { BoardDocument, BoardPiece, BoardPlayer } from "@openrift/shared/board-state";
import { isDeckZone, shownBattlefields } from "@openrift/shared/board-state";
import { CARD_ASPECT, LANDSCAPE_CARD_ASPECT } from "@openrift/shared/card-orientation";

export const BOARD_GAP = 8;
export const SLOT_GAP = 4;
export const SEAT_ROW_GAP = 4;
export const SEAT_INSET = 9;
export const SLOT_CHROME = 10;
export const LABEL_H = 14;
export const MAX_LABEL_SIZE = 11;
const MIN_LABEL_SIZE = 8;
const MAX_FRAME_H = Math.round(150 / LANDSCAPE_CARD_ASPECT);
const MIN_PIECE_H = 16;
const MAX_PIECE_H = 72;
const BATTLEFIELD_CHROME_H = 24;

const SHORT_ZONE_LABEL_EN: Record<SeatZone, string> = {
  runeDeck: "R. deck",
  runes: "Runes",
  champion: "Champ",
  legend: "Legend",
  base: "Base",
  deck: "Deck",
  trash: "Trash",
  banishment: "Banish",
};

/** Hanken Grotesk bold capitals with 1px tracking; errs wide so a planned label never overflows. */
export function labelWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * (fontSize * 0.68 + 1));
}

export function tileWidth(piece: BoardPiece, pieceH: number): number {
  return Math.round(piece.exhausted ? pieceH : pieceH * CARD_ASPECT);
}

export interface SlotBox {
  zone: SeatZone;
  row: number;
  x: number;
  width: number;
  label: string;
  labelSize: number;
}

export interface SeatPlan {
  player: BoardPlayer;
  x: number;
  width: number;
  slots: SlotBox[];
}

export interface BoardPlan {
  pieceH: number;
  rowH: number;
  slotRows: number;
  handH: number;
  halfH: number;
  frameH: number;
  seats: { top: SeatPlan[]; bottom: SeatPlan[] };
}

function slotContentWidth(
  zone: SeatZone,
  player: BoardPlayer,
  pieces: readonly BoardPiece[],
  pieceH: number,
): number {
  const held = piecesAt({ pieces }, { kind: zone }, player);
  if (held.length === 0) {
    return isDeckZone({ kind: zone }) ? Math.round(pieceH * CARD_ASPECT) : 0;
  }
  return (
    held.reduce((sum, piece) => sum + tileWidth(piece, pieceH), 0) + SLOT_GAP * (held.length - 1)
  );
}

function chooseLabel(player: BoardPlayer, zone: SeatZone, room: number): [string, number] {
  for (const word of [BOARD_ZONE_LABEL_EN[zone], SHORT_ZONE_LABEL_EN[zone]]) {
    const text = `${player} · ${word}`;
    for (let size = MAX_LABEL_SIZE; size >= MIN_LABEL_SIZE; size--) {
      if (labelWidth(text, size) <= room) {
        return [text, size];
      }
    }
  }
  return [`${player} · ${SHORT_ZONE_LABEL_EN[zone]}`, MIN_LABEL_SIZE];
}

function planRow(
  zones: readonly SeatZone[],
  row: number,
  player: BoardPlayer,
  pieces: readonly BoardPiece[],
  pieceH: number,
  innerW: number,
): SlotBox[] | null {
  const shortLabel = (zone: SeatZone) => `${player} · ${SHORT_ZONE_LABEL_EN[zone]}`;
  const fullLabel = (zone: SeatZone) => `${player} · ${BOARD_ZONE_LABEL_EN[zone]}`;
  const content = zones.map((zone) => slotContentWidth(zone, player, pieces, pieceH));
  const widths = zones.map(
    (zone, index) =>
      Math.max(content[index] ?? 0, labelWidth(shortLabel(zone), MIN_LABEL_SIZE)) + SLOT_CHROME,
  );
  const available = innerW - SLOT_GAP * Math.max(0, zones.length - 1);
  let spare = available - widths.reduce((sum, width) => sum + width, 0);
  if (spare < 0) {
    return null;
  }
  zones.forEach((zone, index) => {
    const wanted =
      Math.max(content[index] ?? 0, labelWidth(fullLabel(zone), MAX_LABEL_SIZE)) + SLOT_CHROME;
    const grant = Math.min(spare, Math.max(0, wanted - (widths[index] ?? 0)));
    widths[index] = (widths[index] ?? 0) + grant;
    spare -= grant;
  });
  const baseIndex = zones.indexOf("base");
  if (baseIndex !== -1) {
    widths[baseIndex] = (widths[baseIndex] ?? 0) + spare;
  }
  let x = 0;
  return zones.map((zone, index) => {
    const width = widths[index] ?? 0;
    const [label, labelSize] = chooseLabel(player, zone, width - SLOT_CHROME);
    const box = { zone, row, x, width, label, labelSize };
    x += width + SLOT_GAP;
    return box;
  });
}

function planSeat(
  player: BoardPlayer,
  x: number,
  width: number,
  slots: readonly SeatZone[],
  slotRows: number,
  pieces: readonly BoardPiece[],
  pieceH: number,
): SeatPlan | null {
  const perRow = Math.ceil(slots.length / slotRows);
  const boxes: SlotBox[] = [];
  for (let row = 0; row < slotRows; row++) {
    const zones = slots.slice(row * perRow, (row + 1) * perRow);
    const planned = planRow(zones, row, player, pieces, pieceH, width - SEAT_INSET);
    if (planned === null) {
      return null;
    }
    boxes.push(...planned);
  }
  return { player, x, width, slots: boxes };
}

function planSide(
  players: readonly BoardPlayer[],
  innerW: number,
  slots: readonly SeatZone[],
  slotRows: number,
  pieces: readonly BoardPiece[],
  pieceH: number,
): SeatPlan[] | null {
  const seatW = Math.floor((innerW - BOARD_GAP * Math.max(0, players.length - 1)) / players.length);
  const seats: SeatPlan[] = [];
  for (const [index, player] of players.entries()) {
    const seat = planSeat(
      player,
      index * (seatW + BOARD_GAP),
      seatW,
      slots,
      slotRows,
      pieces,
      pieceH,
    );
    if (seat === null) {
      return null;
    }
    seats.push(seat);
  }
  return seats;
}

export function boardHeightUsed(
  document: BoardDocument,
  plan: Pick<BoardPlan, "rowH" | "slotRows" | "handH" | "halfH" | "frameH">,
): number {
  const seatRows = plan.slotRows * plan.rowH + (plan.slotRows - 1) * SEAT_ROW_GAP;
  const side = seatRows + (document.zones.hand ? SEAT_ROW_GAP + plan.handH : 0);
  const battlefields =
    shownBattlefields(document).length > 0
      ? 2 * BOARD_GAP + 2 * plan.halfH + plan.frameH + BATTLEFIELD_CHROME_H
      : BOARD_GAP;
  return 2 * side + battlefields;
}

function planAt(
  document: BoardDocument,
  seats: BoardSeats,
  pieceH: number,
  slotRows: number,
  area: { width: number; height: number },
  enforceHeight = true,
): BoardPlan | null {
  const pieces = document.steps[0]?.pieces ?? [];
  const slots = seatSlots(document.zones);
  const top = planSide(seats.top, area.width, slots, slotRows, pieces, pieceH);
  const bottom = planSide(seats.bottom, area.width, slots, slotRows, pieces, pieceH);
  if (top === null || bottom === null) {
    return null;
  }
  const rowH = pieceH + LABEL_H + 2 + SLOT_CHROME;
  const handH = document.zones.hand ? pieceH + LABEL_H + 2 : 0;
  const frameH = Math.min(MAX_FRAME_H, Math.round(pieceH * 1.5));
  const halfMin = pieceH + 4;
  const draft = { rowH, slotRows, handH, halfH: halfMin, frameH };
  const spare = area.height - boardHeightUsed(document, draft);
  if (spare < 0 && enforceHeight) {
    return null;
  }
  return {
    ...draft,
    pieceH,
    halfH: halfMin + Math.max(0, Math.floor(spare / 2)),
    seats: { top, bottom },
  };
}

export function planBoardImage(
  document: BoardDocument,
  seats: BoardSeats,
  area: { width: number; height: number },
): BoardPlan {
  for (let pieceH = MAX_PIECE_H; pieceH >= MIN_PIECE_H; pieceH--) {
    for (const slotRows of [1, 2]) {
      const plan = planAt(document, seats, pieceH, slotRows, area);
      if (plan !== null) {
        return plan;
      }
    }
  }
  const smallest = planAt(document, seats, MIN_PIECE_H, 2, area, false);
  if (smallest === null) {
    throw new Error("A board seat cannot fit the share image at the smallest piece size");
  }
  return smallest;
}
