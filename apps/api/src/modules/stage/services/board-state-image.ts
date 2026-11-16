import type { BoardSeats } from "@openrift/shared/board-layout";
import {
  BOARD_ZONE_LABEL_EN,
  CHAIN_TYPE_LABEL_EN,
  PIECE_KIND_LABEL_EN,
  pieceNumerals,
  piecesAt,
  seatsFor,
} from "@openrift/shared/board-layout";
import type {
  BoardChainEntry,
  BoardDocument,
  BoardPiece,
  BoardPlayer,
  BoardZoneRef,
} from "@openrift/shared/board-state";
import { chainEntryName, isDeckZone, shownBattlefields } from "@openrift/shared/board-state";
import { CARD_ASPECT, LANDSCAPE_CARD_ASPECT } from "@openrift/shared/card-orientation";
import { clamp } from "@openrift/shared/math";
import { SHARE_IMAGE_COLORS } from "@openrift/shared/share-image-palette";
import { boardImageCanvas } from "@openrift/shared/share-image-params";

import type { Io } from "../../../io.js";
import type { Child, Element } from "../../system/services/share-image-core.js";
import { element, elideTitle, renderTreeToPng } from "../../system/services/share-image-core.js";
import {
  SHARE_TYPE,
  hostFooter,
  shareCanvas,
  titleBlock,
} from "../../system/services/share-image-frame.js";
import type { BoardPlan, SeatPlan, SlotBox } from "../lib/board-image-layout.js";
import {
  BOARD_GAP,
  LABEL_H,
  MAX_LABEL_SIZE,
  boardHeightUsed,
  SEAT_INSET,
  SEAT_ROW_GAP,
  SLOT_GAP,
  planBoardImage,
  tileWidth,
} from "../lib/board-image-layout.js";

const { pad: PAD, titleH: TITLE_H, footerH: FOOTER_H } = SHARE_TYPE.landscape;
const GAP = BOARD_GAP;
const CHAIN_H = 40;
const MIN_FRAME_W = 110;
const KEYWORD_COLOR = "#707070";
const WRAP_MAX_PIECE_H = 120;
const WRAP_FONT_MAX = 11;
const MAX_NAME_LINES = 4;

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

export interface BoardStateImageInput {
  title: string;
  ownerName?: string;
  document: BoardDocument;
  siteHost?: string;
}

export function pieceText(piece: BoardPiece, max: number): string {
  return elideTitle(piece.card?.name ?? PIECE_KIND_LABEL_EN[piece.kind], max);
}

export function chainEntryText(entry: BoardChainEntry, pieces: readonly BoardPiece[]): string {
  return chainEntryName(entry, pieces) ?? CHAIN_TYPE_LABEL_EN[entry.type];
}

const MIN_BADGE_CHARS = 5;

export function readableBadges(piece: BoardPiece, maxChars: number): string[] {
  return [...(piece.label === undefined ? [] : [piece.label]), ...piece.keywords]
    .filter((badge) => badge.length <= maxChars || maxChars >= MIN_BADGE_CHARS)
    .map((badge) => elideTitle(badge, maxChars));
}

/** The keyword row is drawn only when the name keeps one full line; 10px is the tile's border and padding. */
export function keywordsFit(piece: BoardPiece, tileH: number, fontSize: number): boolean {
  const rows = (piece.might !== 0 || piece.damage > 0 ? 1 : 0) + 2;
  return tileH - 10 >= rows * fontSize * 1.2 + fontSize * 1.1;
}

function upperLabel(
  text: string,
  fontSize = MAX_LABEL_SIZE,
  color = "rgba(255,255,255,0.5)",
): Element {
  return element(
    "div",
    {
      display: "flex",
      height: LABEL_H,
      alignItems: "center",
      fontSize,
      fontWeight: 700,
      letterSpacing: 1,
      color,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    },
    text,
  );
}

function keywordBadge(text: string, fontSize: number): Element {
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
    text,
  );
}

function tileFontSize(pieceH: number, wrap: boolean): number {
  return wrap
    ? clamp(Math.round(pieceH / 8), 8, WRAP_FONT_MAX)
    : Math.max(8, Math.round(pieceH / 5.5));
}

export function wrappedLineCount(text: string, perLine: number): number {
  let lines = 0;
  let used = perLine;
  for (const word of text.split(" ")) {
    if (used + 1 + word.length <= perLine) {
      used += 1 + word.length;
    } else {
      lines += Math.ceil(Math.max(1, word.length) / perLine);
      used = word.length % perLine || perLine;
    }
  }
  return lines;
}

export interface WrappedName {
  text: string;
  lines: number;
  perLine: number;
}

export function wrappedName(piece: BoardPiece, pieceH: number): WrappedName {
  const width = tileWidth(piece, pieceH);
  const height = Math.round(piece.exhausted ? pieceH * CARD_ASPECT : pieceH);
  const fontSize = tileFontSize(pieceH, true);
  const badgeRow =
    readableBadges(piece, Math.floor((width - 10) / (fontSize * 0.62))).length > 0 &&
    keywordsFit(piece, height, fontSize);
  const rows = (piece.might !== 0 || piece.damage > 0 ? 1 : 0) + 1 + (badgeRow ? 1 : 0);
  const lines = clamp(
    Math.floor((height - 10 - rows * fontSize * 1.2) / (fontSize * 1.1)),
    1,
    MAX_NAME_LINES,
  );
  const perLine = Math.max(1, Math.floor((width - 10) / (fontSize * 0.55)));
  const full = pieceText(piece, Number.POSITIVE_INFINITY);
  let text = full;
  for (let max = full.length - 1; max >= 2 && wrappedLineCount(text, perLine) > lines; max--) {
    text = elideTitle(full, max);
  }
  return { text, lines, perLine };
}

function pieceTile(piece: BoardPiece, pieceH: number, wrap: boolean, numeral?: number): Element {
  const color = PLAYER_COLORS[piece.owner];
  if (piece.facedown) {
    return cardBack(pieceH, piece.highlight ? SHARE_IMAGE_COLORS.gold : color);
  }
  const width = tileWidth(piece, pieceH);
  const height = Math.round(piece.exhausted ? pieceH * CARD_ASPECT : pieceH);
  const fontSize = tileFontSize(pieceH, wrap);
  const badges = readableBadges(piece, Math.floor((width - 10) / (fontSize * 0.62)));
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
      backgroundColor: SHARE_IMAGE_COLORS.surface,
      border: `2px solid ${piece.highlight ? SHARE_IMAGE_COLORS.gold : color}`,
      overflow: "hidden",
      lineHeight: 1.2,
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
            color: piece.might > 0 ? "#6cc39a" : SHARE_IMAGE_COLORS.muted,
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
        minHeight: Math.ceil(fontSize * 1.1),
        fontSize,
        lineHeight: 1.1,
        color: SHARE_IMAGE_COLORS.text,
        overflow: "hidden",
        ...(wrap ? { wordBreak: "break-word" } : {}),
      },
      wrap
        ? wrappedName(piece, pieceH).text
        : pieceText(piece, Math.max(6, Math.floor((width / fontSize) * 2.5))),
    ),
    badges.length > 0 &&
      keywordsFit(piece, height, fontSize) &&
      element(
        "div",
        {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 2,
          height: Math.ceil(fontSize * 1.2),
          overflow: "hidden",
        },
        ...badges.slice(0, 2).map((badge) => keywordBadge(badge, fontSize)),
      ),
    element(
      "div",
      { display: "flex", flexDirection: "row", alignItems: "flex-end", gap: 3 },
      numeral !== undefined &&
        element(
          "div",
          { display: "flex", fontSize, fontWeight: 700, color: SHARE_IMAGE_COLORS.gold },
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
  wrap: boolean,
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
    ...pieces.map((piece) => pieceTile(piece, pieceH, wrap, numerals.get(piece.id))),
  );
}

function cardBack(pieceH: number, color: string): Element {
  return element("div", {
    display: "flex",
    flexShrink: 0,
    width: Math.round(pieceH * CARD_ASPECT),
    height: Math.round(pieceH),
    borderRadius: 4,
    backgroundColor: FELT_EDGE,
    border: `1px solid ${color}`,
  });
}

function seatSlotBox(
  box: SlotBox,
  player: BoardPlayer,
  pieces: readonly BoardPiece[],
  pieceH: number,
  wrap: boolean,
  numerals: Map<string, number>,
): Element {
  const color = PLAYER_COLORS[player];
  const held = piecesAt({ pieces }, { kind: box.zone }, player);
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      width: box.width,
      padding: 4,
      gap: 2,
      borderRadius: 6,
      border: `1px dashed ${FELT_LINE}`,
      overflow: "hidden",
    },
    upperLabel(box.label, box.labelSize),
    isDeckZone({ kind: box.zone }) && held.length === 0
      ? cardBack(pieceH, color)
      : pieceRow(held, pieceH, wrap, numerals),
  );
}

function seatBlock(
  seat: SeatPlan,
  plan: BoardPlan,
  pieces: readonly BoardPiece[],
  wrap: boolean,
  numerals: Map<string, number>,
): Element {
  const rows = Array.from({ length: plan.slotRows }, (_, row) =>
    seat.slots.filter((box) => box.row === row),
  );
  return element(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      width: seat.width,
      gap: SEAT_ROW_GAP,
      paddingLeft: SEAT_INSET - 3,
      borderLeft: `3px solid ${PLAYER_COLORS[seat.player]}`,
    },
    ...rows.map((boxes) =>
      element(
        "div",
        { display: "flex", flexDirection: "row", height: plan.rowH, gap: SLOT_GAP },
        ...boxes.map((box) => seatSlotBox(box, seat.player, pieces, plan.pieceH, wrap, numerals)),
      ),
    ),
  );
}

function handStrip(
  document: BoardDocument,
  pieces: readonly BoardPiece[],
  players: readonly BoardPlayer[],
  pieceH: number,
  handH: number,
  wrap: boolean,
  numerals: Map<string, number>,
): Child {
  if (!document.zones.hand) {
    return false;
  }
  return element(
    "div",
    { display: "flex", flexDirection: "row", flexShrink: 0, height: handH, gap: GAP },
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
        upperLabel(`${player} · ${BOARD_ZONE_LABEL_EN.hand}`),
        pieceRow(piecesAt({ pieces }, { kind: "hand" }, player), pieceH, wrap, numerals),
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
  frameH: number,
  wrap: boolean,
  numerals: Map<string, number>,
): Child {
  if (document.battlefields.length === 0) {
    return false;
  }
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
          pieceRow(piecesAt({ pieces }, zone, player), pieceH, wrap, numerals),
        ),
      ),
    );
  return element(
    "div",
    { display: "flex", flexDirection: "row", flexShrink: 0, gap: GAP },
    ...shownBattlefields(document).map((index) => {
      const battlefield = document.battlefields[index];
      const zone: BoardZoneRef = { kind: "battlefield", index };
      const controller = document.steps[0]?.battlefields[index]?.controller ?? null;
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
          border:
            controller === null
              ? "1px solid rgba(255,255,255,0.12)"
              : `2px solid ${PLAYER_COLORS[controller]}`,
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
              width: Math.max(MIN_FRAME_W, Math.round(frameH * LANDSCAPE_CARD_ASPECT)),
              height: frameH,
              padding: 4,
              borderRadius: 6,
              backgroundColor: "rgba(0,0,0,0.4)",
              border: `1px solid ${SHARE_IMAGE_COLORS.gold}`,
              fontSize: clamp(Math.round(frameH / 4), 9, 13),
              lineHeight: 1.1,
              fontWeight: 700,
              color: SHARE_IMAGE_COLORS.gold,
              textAlign: "center",
              overflow: "hidden",
            },
            elideTitle(battlefield?.card?.name ?? `Battlefield ${index + 1}`, 34),
          ),
          ...piecesAt({ pieces }, { kind: "facedown", index }).map((piece) =>
            pieceTile(piece, Math.min(pieceH, frameH), wrap),
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
  const pieces = document.steps[0]?.pieces ?? [];
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
    upperLabel(BOARD_ZONE_LABEL_EN.chain),
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
        elideTitle(chainEntryText(entry, pieces), 26),
      ),
    ),
  );
}

export interface BoardStateImage {
  tree: Element;
  width: number;
  height: number;
}

export function boardStateImage(input: BoardStateImageInput): BoardStateImage {
  const { document } = input;
  const canvas = boardImageCanvas(document.playerCount);
  const { width } = canvas;
  const wrap = document.playerCount >= 3;
  const step = document.steps[0];
  const pieces = step?.pieces ?? [];
  const numerals = pieceNumerals(pieces);
  const seats = seatsFor(document.playerCount);
  const hasFooter = Boolean(input.siteHost);
  const chainH = document.zones.chain ? CHAIN_H + GAP : 0;
  const maxBoardH =
    canvas.height - PAD * 2 - TITLE_H - GAP - chainH - (hasFooter ? FOOTER_H + GAP : 0);
  const plan = planBoardImage(
    document,
    seats,
    { width: width - PAD * 2, height: maxBoardH },
    wrap ? { maxPieceH: WRAP_MAX_PIECE_H, fillHeight: false } : {},
  );
  const boardH = wrap ? Math.min(maxBoardH, boardHeightUsed(document, plan)) : maxBoardH;
  const height = canvas.height - (maxBoardH - boardH);
  const { pieceH, handH, halfH, frameH } = plan;

  const side = (which: "top" | "bottom"): Element => {
    const players = seats[which];
    const rows: Child[] = [
      element(
        "div",
        { display: "flex", flexDirection: "row", flexShrink: 0, gap: GAP },
        ...plan.seats[which].map((seat) => seatBlock(seat, plan, pieces, wrap, numerals)),
      ),
      handStrip(document, pieces, players, pieceH, handH, wrap, numerals),
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
    battlefieldRow(document, pieces, seats, pieceH, halfH, frameH, wrap, numerals),
    side("bottom"),
  );

  const tree = shareCanvas(
    width,
    height,
    {
      flexDirection: "column",
      padding: PAD,
      backgroundColor: FELT,
      backgroundImage:
        "radial-gradient(80% 120% at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 65%)",
    },
    titleBlock({
      aspect: "landscape",
      title: input.title,
      ownerName: input.ownerName,
      height: TITLE_H,
    }),
    element("div", { display: "flex", height: GAP, flexShrink: 0 }),
    board,
    hasFooter &&
      hostFooter({
        siteHost: input.siteHost,
        aspect: "landscape",
        marginTop: GAP,
        color: "rgba(255,255,255,0.6)",
      }),
  );
  return { tree, width, height };
}

export function boardStateTree(input: BoardStateImageInput): Element {
  return boardStateImage(input).tree;
}

export function renderBoardStateImage(
  io: Io,
  input: BoardStateImageInput,
  scale = 1,
): Promise<Buffer> {
  const { tree, width, height } = boardStateImage(input);
  return renderTreeToPng(io, tree, width, height, scale);
}
