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
const CHAIN_H = 40;
const ZONE_LABEL_SIZE = 11;
const PIECE_ASPECT = 0.715;
const BATTLEFIELD_W = 150;
const BATTLEFIELD_ASPECT = 1.4;
const KEYWORD_COLOR = "#707070";

/** Hex equivalents of the web board's oklch player colors; satori has no oklch. */
const PLAYER_COLORS: Record<BoardPlayer, string> = {
  A: "#2a8080",
  B: "#a37734",
  C: "#925b8d",
  D: "#518046",
};

/** Hex equivalents of `--board-felt` and `--board-felt-edge`. */
const FELT = "#143c3e";
const FELT_EDGE = "#0c2729";
const FELT_LINE = "rgba(255,255,255,0.35)";

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

const SLOT_LABEL: Record<"runeDeck" | "deck", string> = {
  runeDeck: "rune deck",
  deck: "deck",
};

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

export function seatSlots(document: BoardDocument): SeatSlot[] {
  return SEAT_ORDER.filter((slot) =>
    slot.kind === "stack" ? document.zones.deck : document.zones[slot.zone],
  );
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

/** Numerals for pieces whose name is shared by another piece, 1-based in piece order. */
export function pieceNumerals(pieces: readonly BoardPiece[]): Map<string, number> {
  const groups = Map.groupBy(pieces, (piece) => piece.card?.name ?? `kind:${piece.kind}`);
  const numerals = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    group.forEach((piece, index) => numerals.set(piece.id, index + 1));
  }
  return numerals;
}

/** Units: one seat row and one hand strip per side, two for the battlefield halves. */
export function measurePieceHeight(document: BoardDocument, boardH: number): number {
  const units = 2 + (document.zones.hand ? 2 : 0) + (document.battlefields.length > 0 ? 2 : 0);
  const unitH = boardH / Math.max(1, units);
  return Math.max(24, Math.min(72, Math.floor(unitH - ZONE_LABEL_SIZE - 14)));
}

function upperLabel(text: string, color = "rgba(255,255,255,0.5)"): Element {
  return element(
    "div",
    {
      display: "flex",
      fontSize: ZONE_LABEL_SIZE,
      fontWeight: 700,
      letterSpacing: 1,
      color,
      textTransform: "uppercase",
    },
    text,
  );
}

function keywordBadge(keyword: string, fontSize: number): Element {
  return element(
    "div",
    {
      display: "flex",
      backgroundColor: KEYWORD_COLOR,
      color: "#ffffff",
      fontSize,
      fontWeight: 700,
      paddingLeft: 2,
      paddingRight: 2,
      textTransform: "uppercase",
    },
    elideTitle(keyword, 12),
  );
}

function pieceTile(piece: BoardPiece, pieceH: number, numeral: number | undefined): Element {
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
      { display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 3 },
      piece.might !== 0 &&
        element(
          "div",
          {
            display: "flex",
            fontSize,
            fontWeight: 700,
            color: piece.might > 0 ? "#6cc39a" : COLORS.muted,
          },
          piece.might > 0 ? `+${piece.might}` : `−${Math.abs(piece.might)}`,
        ),
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
    piece.keywords.length > 0 &&
      element(
        "div",
        { display: "flex", flexDirection: "row", gap: 2, overflow: "hidden" },
        ...piece.keywords.slice(0, 2).map((keyword) => keywordBadge(keyword, fontSize)),
      ),
    element(
      "div",
      { display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 3 },
      numeral !== undefined &&
        element(
          "div",
          { display: "flex", fontSize, fontWeight: 700, color: COLORS.gold },
          String(numeral),
        ),
      element(
        "div",
        { display: "flex", marginLeft: "auto", fontSize, fontWeight: 700, color },
        piece.owner,
      ),
    ),
  );
}

function pieceRow(
  pieces: readonly BoardPiece[],
  pieceH: number,
  numerals: Map<string, number>,
): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: 4,
      flexGrow: 1,
      overflow: "hidden",
    },
    ...pieces.map((piece) => pieceTile(piece, pieceH, numerals.get(piece.id))),
  );
}

function cardBack(pieceH: number, color: string): Element {
  return element("div", {
    display: "flex",
    flexShrink: 0,
    width: Math.round(pieceH * PIECE_ASPECT),
    height: Math.round(pieceH),
    borderRadius: 4,
    backgroundColor: FELT_EDGE,
    border: `1px solid ${color}`,
  });
}

function seatSlotBox(
  slot: SeatSlot,
  player: BoardPlayer,
  pieces: readonly BoardPiece[],
  pieceH: number,
  numerals: Map<string, number>,
): Element {
  const color = PLAYER_COLORS[player];
  const isBase = slot.kind === "zone" && slot.zone === "base";
  const label = slot.kind === "zone" ? slot.zone : SLOT_LABEL[slot.stack];
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexGrow: isBase ? 1 : 0,
      flexShrink: 0,
      padding: 4,
      gap: 2,
      borderRadius: 6,
      border: `1px dashed ${FELT_LINE}`,
      overflow: "hidden",
    },
    upperLabel(`${label} ${player}`),
    slot.kind === "stack"
      ? cardBack(pieceH, color)
      : pieceRow(piecesIn(pieces, { kind: slot.zone }, [player]), pieceH, numerals),
  );
}

function seatBlock(
  pieces: readonly BoardPiece[],
  player: BoardPlayer,
  slots: readonly SeatSlot[],
  pieceH: number,
  numerals: Map<string, number>,
): Element {
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      flexGrow: 1,
      flexBasis: 0,
      gap: 4,
      paddingLeft: 6,
      borderLeft: `3px solid ${PLAYER_COLORS[player]}`,
      overflow: "hidden",
    },
    ...slots.map((slot) => seatSlotBox(slot, player, pieces, pieceH, numerals)),
  );
}

function handStrip(
  document: BoardDocument,
  pieces: readonly BoardPiece[],
  players: readonly BoardPlayer[],
  pieceH: number,
  numerals: Map<string, number>,
): Child {
  if (!document.zones.hand) {
    return false;
  }
  return element(
    "div",
    { display: "flex", flexDirection: "row", flexShrink: 0, gap: GAP },
    ...players.map((player) =>
      element(
        "div",
        {
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          flexBasis: 0,
          gap: 2,
          overflow: "hidden",
        },
        upperLabel(`hand ${player}`),
        pieceRow(piecesIn(pieces, { kind: "hand" }, [player]), pieceH, numerals),
      ),
    ),
  );
}

function battlefieldRow(
  document: BoardDocument,
  pieces: readonly BoardPiece[],
  seats: BoardSeats,
  pieceH: number,
  halfH: number,
  numerals: Map<string, number>,
): Child {
  if (document.battlefields.length === 0) {
    return false;
  }
  const frameH = Math.round(BATTLEFIELD_W / BATTLEFIELD_ASPECT);
  const half = (players: readonly BoardPlayer[], zone: BoardZoneRef) =>
    element(
      "div",
      { display: "flex", flexDirection: "row", height: halfH, flexShrink: 0, gap: 4 },
      ...players.map((player) =>
        element(
          "div",
          {
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            flexBasis: 0,
            paddingLeft: 4,
            borderLeft: `2px solid ${PLAYER_COLORS[player]}`,
            overflow: "hidden",
          },
          pieceRow(piecesIn(pieces, zone, [player]), pieceH, numerals),
        ),
      ),
    );
  return element(
    "div",
    { display: "flex", flexDirection: "row", flexShrink: 0, gap: GAP },
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
          gap: 4,
          borderRadius: 8,
          backgroundColor: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
        },
        half(seats.top, zone),
        element(
          "div",
          { display: "flex", flexDirection: "row", justifyContent: "center", flexShrink: 0 },
          element(
            "div",
            {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: BATTLEFIELD_W,
              height: frameH,
              padding: 6,
              borderRadius: 6,
              backgroundColor: "rgba(0,0,0,0.4)",
              border: `1px solid ${COLORS.gold}`,
              fontSize: 13,
              fontWeight: 700,
              color: COLORS.gold,
              textAlign: "center",
              overflow: "hidden",
            },
            elideTitle(battlefield.card?.name ?? `Battlefield ${index + 1}`, 34),
          ),
        ),
        half(seats.bottom, zone),
      );
    }),
  );
}

function chainRow(document: BoardDocument): Child {
  if (!document.zones.chain) {
    return false;
  }
  const chain = document.steps[0]?.chain ?? [];
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      height: CHAIN_H,
      flexShrink: 0,
      padding: 6,
      gap: 6,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.12)",
      overflow: "hidden",
    },
    upperLabel("chain"),
    ...chain.map((entry) =>
      element(
        "div",
        {
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 4,
          padding: 4,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.9)",
          fontSize: 12,
          color: "#111111",
          overflow: "hidden",
        },
        element(
          "div",
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 14,
            height: 14,
            flexShrink: 0,
            borderRadius: 7,
            backgroundColor: PLAYER_COLORS[entry.owner],
            color: "#ffffff",
            fontSize: 10,
            fontWeight: 700,
          },
          entry.owner,
        ),
        elideTitle(entry.card.name, 26),
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
  const step = document.steps[0];
  const pieces = step?.pieces ?? [];
  const numerals = pieceNumerals(pieces);
  const seats = seatsFor(document.playerCount);
  const hasFooter = Boolean(input.siteHost);
  const chainH = document.zones.chain ? CHAIN_H + GAP : 0;
  const boardH = height - PAD * 2 - TITLE_H - GAP - chainH - (hasFooter ? FOOTER_H + GAP : 0);
  const pieceH = measurePieceHeight(document, boardH);
  const rowH = pieceH + ZONE_LABEL_SIZE + 18;
  const handH = document.zones.hand ? pieceH + ZONE_LABEL_SIZE + 6 : 0;
  const frameH = Math.round(BATTLEFIELD_W / BATTLEFIELD_ASPECT);
  const halfH = Math.max(
    pieceH + 4,
    Math.floor((boardH - 2 * rowH - 2 * handH - frameH - GAP * 6) / 2),
  );

  const side = (which: "top" | "bottom"): Element => {
    const slots = seatSlots(document);
    const players = seats[which];
    const rows: Child[] = [
      element(
        "div",
        { display: "flex", flexDirection: "row", flexShrink: 0, height: rowH, gap: GAP },
        ...players.map((player) => seatBlock(pieces, player, slots, pieceH, numerals)),
      ),
      handStrip(document, pieces, players, pieceH, numerals),
    ];
    return element(
      "div",
      { display: "flex", flexDirection: "column", flexShrink: 0, gap: 4 },
      ...(which === "top" ? rows.toReversed() : rows),
    );
  };

  const board = element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      height: boardH + chainH,
      gap: GAP,
      flexShrink: 0,
      overflow: "hidden",
    },
    chainRow(document),
    side("top"),
    battlefieldRow(document, pieces, seats, pieceH, halfH, numerals),
    side("bottom"),
  );

  const root = element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      width,
      height,
      padding: PAD,
      backgroundColor: FELT,
      backgroundImage:
        "radial-gradient(80% 120% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 65%)",
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
          color: "rgba(255,255,255,0.6)",
        },
        input.siteHost ?? "",
      ),
  );

  return renderTreeToPng(io, root, width, height, scale);
}
