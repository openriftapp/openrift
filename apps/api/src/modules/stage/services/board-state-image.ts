import type {
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardZoneRef,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import { SHARE_IMAGE_CANVAS } from "@openrift/shared/share-image-params";

import type { Io } from "../../../io.js";
import type { Child, Element } from "../../system/services/share-image-core.js";
import {
  COLORS,
  element,
  elideTitle,
  renderTreeToPng,
} from "../../system/services/share-image-core.js";

const PAD = 24;
const GAP = 8;
const TITLE_H = 44;
const TITLE_SIZE = 32;
const TITLE_MAX_CHARS = 52;
const FOOTER_H = 24;
const CHAIN_W = 220;
const ZONE_LABEL_SIZE = 11;
const PIECE_ASPECT = 0.715;

/** Hex equivalents of the web board's oklch player colors; satori has no oklch. */
export const PLAYER_COLORS: Record<BoardPlayer, string> = {
  A: "#2a8080",
  B: "#a37734",
  C: "#925b8d",
  D: "#518046",
};

const NEAR_ROW: readonly PlayerZoneKind[] = ["legend", "champion", "base"];
const FAR_ROW: readonly PlayerZoneKind[] = ["runes", "hand", "trash"];

export interface BoardStateImageInput {
  title: string;
  document: BoardDocument;
  siteHost?: string;
}

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

export interface ZoneSlot {
  kind: PlayerZoneKind;
  visible: boolean;
}

/** The near row faces the battlefields, so the top seat lists its rows far-first. */
export function seatRows(document: BoardDocument, side: "top" | "bottom"): ZoneSlot[][] {
  const slots = (row: readonly PlayerZoneKind[]) =>
    row.map((kind) => ({ kind, visible: document.zones[kind] }));
  const rows = [slots(NEAR_ROW), slots(FAR_ROW)].filter((row) => row.some((slot) => slot.visible));
  return side === "top" ? rows.toReversed() : rows;
}

export function piecesIn(
  pieces: readonly BoardPiece[],
  zone: BoardZoneRef,
  owners: readonly BoardPlayer[],
): BoardPiece[] {
  return pieces.filter(
    (piece) =>
      owners.includes(piece.owner) &&
      (piece.zone.kind === "battlefield" && zone.kind === "battlefield"
        ? piece.zone.index === zone.index
        : piece.zone.kind === zone.kind),
  );
}

export function pieceText(piece: BoardPiece, max: number): string {
  return elideTitle(piece.card?.name ?? piece.label ?? piece.kind, max);
}

/** Units: one per visible seat row, two for the battlefield row (one per half). */
export function measurePieceHeight(document: BoardDocument, boardH: number): number {
  const units =
    seatRows(document, "top").length +
    seatRows(document, "bottom").length +
    (document.battlefields.length > 0 ? 2 : 0);
  const unitH = boardH / Math.max(1, units);
  return Math.max(24, Math.min(72, Math.floor(unitH - ZONE_LABEL_SIZE - 14)));
}

function upperLabel(text: string): Element {
  return element(
    "div",
    {
      display: "flex",
      fontSize: ZONE_LABEL_SIZE,
      fontWeight: 700,
      letterSpacing: 1,
      color: COLORS.muted,
      textTransform: "uppercase",
    },
    text,
  );
}

function pieceTile(piece: BoardPiece, pieceH: number): Element {
  const color = PLAYER_COLORS[piece.owner];
  const width = Math.round(piece.exhausted ? pieceH : pieceH * PIECE_ASPECT);
  const height = Math.round(piece.exhausted ? pieceH * PIECE_ASPECT : pieceH);
  const fontSize = Math.max(8, Math.round(pieceH / 5.5));
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      width,
      height,
      padding: 3,
      borderRadius: 4,
      backgroundColor: COLORS.surface,
      border: `2px solid ${piece.highlight ? COLORS.gold : color}`,
      overflow: "hidden",
    },
    element(
      "div",
      { display: "flex", flexDirection: "row", alignItems: "center", gap: 3 },
      element("div", { display: "flex", fontSize, fontWeight: 700, color }, piece.owner),
      piece.damage > 0 &&
        element(
          "div",
          { display: "flex", fontSize, fontWeight: 700, color: "#e0655a" },
          String(piece.damage),
        ),
    ),
    element(
      "div",
      {
        display: "flex",
        flexGrow: 1,
        flexShrink: 1,
        fontSize,
        lineHeight: 1.1,
        color: COLORS.text,
        overflow: "hidden",
      },
      pieceText(piece, Math.max(6, Math.floor((width / fontSize) * 2.5))),
    ),
    piece.stunned && element("div", { display: "flex", fontSize, color: COLORS.gold }, "Stunned"),
  );
}

function pieceRow(pieces: readonly BoardPiece[], pieceH: number): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 4,
      flexGrow: 1,
      overflow: "hidden",
    },
    ...pieces.map((piece) => pieceTile(piece, pieceH)),
  );
}

function zoneBox(slot: ZoneSlot, pieces: readonly BoardPiece[], pieceH: number): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexBasis: 0,
      padding: 4,
      gap: 2,
      borderRadius: 6,
      border: slot.visible ? `1px dashed ${COLORS.surfaceBorder}` : "1px solid transparent",
      overflow: "hidden",
    },
    slot.visible && upperLabel(slot.kind),
    slot.visible && pieceRow(pieces, pieceH),
  );
}

function seatBlock(
  pieces: readonly BoardPiece[],
  player: BoardPlayer,
  rows: readonly ZoneSlot[][],
  pieceH: number,
): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      flexBasis: 0,
      gap: 4,
      paddingLeft: 6,
      borderLeft: `3px solid ${PLAYER_COLORS[player]}`,
    },
    ...rows.map((row) =>
      element(
        "div",
        { display: "flex", flexDirection: "row", flexGrow: 1, flexBasis: 0, gap: 4 },
        ...row.map((slot) =>
          zoneBox(slot, piecesIn(pieces, { kind: slot.kind }, [player]), pieceH),
        ),
      ),
    ),
  );
}

function battlefieldRow(
  document: BoardDocument,
  pieces: readonly BoardPiece[],
  seats: BoardSeats,
  pieceH: number,
): Child {
  if (document.battlefields.length === 0) {
    return false;
  }
  return element(
    "div",
    { display: "flex", flexDirection: "row", flexGrow: 2, flexBasis: 0, gap: GAP },
    ...document.battlefields.map((battlefield, index) => {
      const zone: BoardZoneRef = { kind: "battlefield", index };
      return element(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexBasis: 0,
          padding: 6,
          gap: 2,
          borderRadius: 8,
          backgroundColor: "rgba(255,255,255,0.035)",
          border: `1px solid ${COLORS.gold}`,
          overflow: "hidden",
        },
        pieceRow(piecesIn(pieces, zone, seats.top), pieceH),
        element(
          "div",
          { display: "flex", fontSize: 13, fontWeight: 700, color: COLORS.gold },
          elideTitle(battlefield.card?.name ?? `Battlefield ${index + 1}`, 34),
        ),
        pieceRow(piecesIn(pieces, zone, seats.bottom), pieceH),
      );
    }),
  );
}

function chainColumn(document: BoardDocument): Child {
  if (!document.zones.chain) {
    return false;
  }
  const chain = document.steps[0]?.chain ?? [];
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width: CHAIN_W,
      flexShrink: 0,
      padding: 6,
      gap: 4,
      borderRadius: 6,
      border: `1px dashed ${COLORS.surfaceBorder}`,
      overflow: "hidden",
    },
    upperLabel("chain"),
    ...chain.map((entry) =>
      element(
        "div",
        {
          display: "flex",
          fontSize: 12,
          color: COLORS.text,
          paddingLeft: 6,
          borderLeft: `3px solid ${PLAYER_COLORS[entry.owner]}`,
        },
        elideTitle(entry.card?.name ?? entry.text, 30),
      ),
    ),
  );
}

export function renderBoardStateImage(
  io: Io,
  input: BoardStateImageInput,
  scale = 1,
): Promise<Buffer> {
  const { width, height } = SHARE_IMAGE_CANVAS.landscape;
  const { document } = input;
  const pieces = document.steps[0]?.pieces ?? [];
  const seats = seatsFor(document.playerCount);
  const hasFooter = Boolean(input.siteHost);
  const boardH = height - PAD * 2 - TITLE_H - GAP - (hasFooter ? FOOTER_H + GAP : 0);
  const pieceH = measurePieceHeight(document, boardH);

  const half = (side: "top" | "bottom"): Child => {
    const rows = seatRows(document, side);
    return (
      rows.length > 0 &&
      element(
        "div",
        { display: "flex", flexDirection: "row", flexGrow: rows.length, flexBasis: 0, gap: GAP },
        ...seats[side].map((player) => seatBlock(pieces, player, rows, pieceH)),
      )
    );
  };

  const board = element(
    "div",
    { display: "flex", flexDirection: "row", height: boardH, gap: GAP, flexShrink: 0 },
    element(
      "div",
      { display: "flex", flexDirection: "column", flexGrow: 1, gap: GAP },
      half("top"),
      battlefieldRow(document, pieces, seats, pieceH),
      half("bottom"),
    ),
    chainColumn(document),
  );

  const root = element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width,
      height,
      padding: PAD,
      backgroundColor: COLORS.background,
      backgroundImage:
        "radial-gradient(80% 120% at 0% 0%, rgba(205,172,110,0.14) 0%, transparent 60%)",
      color: COLORS.text,
      fontFamily: "Hanken Grotesk",
      overflow: "hidden",
    },
    element(
      "div",
      {
        display: "flex",
        alignItems: "center",
        height: TITLE_H,
        flexShrink: 0,
        fontSize: TITLE_SIZE,
        fontWeight: 700,
        whiteSpace: "nowrap",
      },
      elideTitle(input.title, TITLE_MAX_CHARS),
    ),
    element("div", { display: "flex", height: GAP, flexShrink: 0 }),
    board,
    hasFooter &&
      element(
        "div",
        {
          display: "flex",
          alignItems: "center",
          height: FOOTER_H,
          marginTop: GAP,
          flexShrink: 0,
          fontSize: 20,
          fontWeight: 600,
          color: COLORS.muted,
        },
        input.siteHost ?? "",
      ),
  );

  return renderTreeToPng(io, root, width, height, scale);
}
