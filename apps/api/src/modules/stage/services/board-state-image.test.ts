import type { BoardDocument, BoardPiece } from "@openrift/shared/board-state";
import { emptyBoardDocument } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import {
  measurePieceHeight,
  pieceNumerals,
  pieceText,
  piecesIn,
  renderBoardStateImage,
  seatSlots,
  seatsFor,
} from "./board-state-image.js";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function piece(overrides: Partial<BoardPiece> = {}): BoardPiece {
  return {
    id: "p1",
    owner: "A",
    zone: { kind: "base" },
    kind: "unit",
    card: null,
    exhausted: false,
    keywords: [],
    damage: 0,
    might: 0,
    highlight: false,
    ...overrides,
  };
}

function doc(overrides: Partial<BoardDocument> = {}): BoardDocument {
  return { ...emptyBoardDocument(), ...overrides };
}

const allZones = {
  base: true,
  legend: true,
  champion: true,
  runes: true,
  hand: true,
  trash: true,
  deck: true,
  chain: true,
};

describe("seatsFor", () => {
  it("seats B on top and A at the bottom for two players", () => {
    expect(seatsFor(2)).toEqual({ top: ["B"], bottom: ["A"] });
  });

  it("adds C to the bottom for three players", () => {
    expect(seatsFor(3)).toEqual({ top: ["B"], bottom: ["A", "C"] });
  });

  it("adds D to the top for four players", () => {
    expect(seatsFor(4)).toEqual({ top: ["B", "D"], bottom: ["A", "C"] });
  });
});

describe("seatSlots", () => {
  const key = (slot: { kind: string; zone?: string; stack?: string }) =>
    slot.zone ?? slot.stack ?? slot.kind;

  it("runs the top seat's row in the opposite direction", () => {
    const document = doc({ zones: allZones });
    expect(seatSlots(document).map((slot) => key(slot))).toEqual([
      "runeDeck",
      "runes",
      "champion",
      "legend",
      "base",
      "deck",
      "trash",
    ]);
  });

  it("drops hidden zones and both decks, and never seats the hand", () => {
    const document = doc({
      zones: { ...allZones, runes: false, trash: false, champion: false, deck: false },
    });
    expect(seatSlots(document).map((slot) => key(slot))).toEqual(["legend", "base"]);
  });
});

describe("pieceNumerals", () => {
  it("numbers only the pieces that share a name", () => {
    const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Ashe" };
    const numerals = pieceNumerals([
      piece({ id: "p1", card }),
      piece({ id: "p2", card: { ...card, name: "Vi" } }),
      piece({ id: "p3", card }),
    ]);
    expect([...numerals]).toEqual([
      ["p1", 1],
      ["p3", 2],
    ]);
  });
});

describe("piecesIn", () => {
  const pieces = [
    piece({ id: "p1", owner: "A", zone: { kind: "battlefield", index: 0 } }),
    piece({ id: "p2", owner: "B", zone: { kind: "battlefield", index: 0 } }),
    piece({ id: "p3", owner: "A", zone: { kind: "battlefield", index: 1 } }),
    piece({ id: "p4", owner: "A", zone: { kind: "hand" } }),
  ];

  it("filters battlefield pieces by index and owner", () => {
    expect(
      piecesIn(pieces, { kind: "battlefield", index: 0 }, ["A"]).map((found) => found.id),
    ).toEqual(["p1"]);
  });

  it("matches player zones by kind", () => {
    expect(piecesIn(pieces, { kind: "hand" }, ["A", "B"]).map((found) => found.id)).toEqual(["p4"]);
  });
});

describe("pieceText", () => {
  it("prefers the card name, then the label, then the piece kind", () => {
    const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Jinx" };
    expect(pieceText(piece({ card, label: "x" }), 20)).toBe("Jinx");
    expect(pieceText(piece({ label: "Token" }), 20)).toBe("Token");
    expect(pieceText(piece(), 20)).toBe("unit");
  });
});

describe("measurePieceHeight", () => {
  it("clamps to the minimum when many rows share a short board", () => {
    const document = doc({ zones: allZones, battlefields: [{ card: null }] });
    expect(measurePieceHeight(document, 100)).toBe(24);
  });

  it("clamps to the maximum when the board is nearly empty", () => {
    expect(
      measurePieceHeight(
        doc({ zones: { ...allZones, runes: false, hand: false, trash: false } }),
        2000,
      ),
    ).toBe(72);
  });
});

describe("renderBoardStateImage", () => {
  it("renders a valid 1200x630 PNG for a four-player board", async () => {
    const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Jinx, Loose Cannon" };
    const document = doc({
      playerCount: 4,
      zones: allZones,
      battlefields: [{ card: { ...card, name: "Targon's Peak" } }, { card: null }],
      steps: [
        {
          caption: "",
          pieces: [
            piece({ id: "p1", card, zone: { kind: "battlefield", index: 0 }, damage: 2 }),
            piece({
              id: "p2",
              owner: "B",
              zone: { kind: "battlefield", index: 0 },
              keywords: ["Stun", "Accelerate 2"],
              might: -2,
            }),
            piece({ id: "p3", owner: "D", zone: { kind: "hand" }, exhausted: true }),
            piece({ id: "p4", card, zone: { kind: "base" }, might: 3 }),
          ],
          chain: [{ owner: "C", card }],
          arrows: [],
        },
      ],
    });

    const png = await renderBoardStateImage(defaultIo, {
      title: "Summoner Skirmish showdown",
      document,
      siteHost: "openrift.app",
    });
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });
});
