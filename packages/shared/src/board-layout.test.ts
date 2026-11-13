import { describe, expect, it } from "vitest";

import {
  arrowZoneKey,
  occupiedZones,
  pieceNumerals,
  piecesAt,
  seatSlots,
  seatsFor,
} from "./board-layout.js";
import type { BoardPiece, BoardStep } from "./board-state.js";
import { emptyBoardDocument, emptyBoardStep } from "./board-state.js";

function piece(overrides: Partial<BoardPiece>): BoardPiece {
  return {
    id: "p1",
    owner: "A",
    zone: { kind: "base" },
    kind: "unit",
    card: null,
    exhausted: false,
    facedown: false,
    keywords: [],
    damage: 0,
    might: 0,
    buffs: 0,
    highlight: false,
    ...overrides,
  };
}

describe("seatsFor", () => {
  it("puts A at the bottom and B at the top for two players", () => {
    expect(seatsFor(2)).toEqual({ top: ["B"], bottom: ["A"] });
  });

  it("seats C beside A for three players", () => {
    expect(seatsFor(3)).toEqual({ top: ["B"], bottom: ["A", "C"] });
  });

  it("splits four players two per side", () => {
    expect(seatsFor(4)).toEqual({ top: ["B", "D"], bottom: ["A", "C"] });
  });
});

describe("seatSlots", () => {
  it("orders the table from the rune deck out to banishment", () => {
    const zones = { ...emptyBoardDocument().zones, deck: true, trash: true, banishment: true };
    expect(seatSlots(zones)).toEqual([
      "runeDeck",
      "runes",
      "champion",
      "legend",
      "base",
      "deck",
      "trash",
      "banishment",
    ]);
  });

  it("drops every hidden zone, the base included", () => {
    const zones = {
      base: false,
      legend: false,
      champion: false,
      runes: false,
      hand: false,
      trash: false,
      banishment: false,
      deck: false,
      chain: false,
      score: true,
    };
    expect(seatSlots(zones)).toEqual([]);
  });

  it("never places the hand in the seat row", () => {
    const zones = { ...emptyBoardDocument().zones, hand: true };
    expect(seatSlots(zones)).not.toContain("hand");
  });
});

describe("piecesAt", () => {
  const step: BoardStep = {
    ...emptyBoardStep(2),
    pieces: [
      piece({ id: "a", zone: { kind: "battlefield", index: 0 } }),
      piece({ id: "b", owner: "B", zone: { kind: "battlefield", index: 0 } }),
      piece({ id: "c", owner: "B", zone: { kind: "base" } }),
      piece({ id: "d", zone: { kind: "facedown", index: 0 }, facedown: true }),
    ],
  };

  it("filters by zone", () => {
    expect(piecesAt(step, { kind: "battlefield", index: 0 }).map((p) => p.id)).toEqual(["a", "b"]);
    expect(piecesAt(step, { kind: "facedown", index: 0 }).map((p) => p.id)).toEqual(["d"]);
  });

  it("filters by zone and owner", () => {
    expect(piecesAt(step, { kind: "base" }, "B").map((p) => p.id)).toEqual(["c"]);
    expect(piecesAt(step, { kind: "base" }, "A")).toEqual([]);
  });
});

describe("arrowZoneKey", () => {
  it("keys battlefields by index and owner", () => {
    expect(arrowZoneKey({ kind: "battlefield", index: 2 }, "C")).toBe("battlefield-2-C");
  });

  it("keys player zones by kind and owner", () => {
    expect(arrowZoneKey({ kind: "base" }, "B")).toBe("base-B");
  });

  it("keys a facedown zone by battlefield alone", () => {
    expect(arrowZoneKey({ kind: "facedown", index: 1 }, "A")).toBe("facedown-1");
    expect(arrowZoneKey({ kind: "facedown", index: 1 }, "B")).toBe("facedown-1");
  });
});

describe("pieceNumerals", () => {
  const named = (id: string, name: string): BoardPiece =>
    piece({ id, card: { cardId: "00000000-0000-7000-8000-000000000001", name } });

  it("numbers only pieces that share a name, in piece order", () => {
    const numerals = pieceNumerals([named("p1", "Ashe"), named("p2", "Vi"), named("p3", "Ashe")]);
    expect([...numerals]).toEqual([
      ["p1", 1],
      ["p3", 2],
    ]);
  });

  it("never numbers runes", () => {
    const rune = (id: string) => piece({ id, kind: "rune", zone: { kind: "runes" } });
    expect(pieceNumerals([rune("p1"), rune("p2")]).size).toBe(0);
  });

  it("treats generic pieces of the same kind as sharing a name", () => {
    const numerals = pieceNumerals([
      piece({ id: "p1" }),
      piece({ id: "p2", kind: "gear" }),
      piece({ id: "p3" }),
    ]);
    expect([...numerals]).toEqual([
      ["p1", 1],
      ["p3", 2],
    ]);
  });
});

function stepWith(pieces: BoardPiece[], chainLength = 0): BoardStep {
  const card = { cardId: "019a0000-0000-7000-8000-000000000001", name: "Facebreaker" };
  return {
    ...emptyBoardStep(2),
    pieces,
    chain: Array.from({ length: chainLength }, (_, index) => ({
      id: `c${index + 1}`,
      owner: "A" as const,
      type: "spell" as const,
      card,
    })),
  };
}

describe("occupiedZones", () => {
  it("collects every zone and owner that holds a piece in any step", () => {
    const zones = occupiedZones([
      stepWith([piece({ id: "p1", owner: "B" })]),
      stepWith([piece({ id: "p1", owner: "B", zone: { kind: "battlefield", index: 0 } })]),
    ]);
    expect([...zones].toSorted()).toEqual(["base-B", "battlefield-0-B"]);
  });

  it("is empty for a board without pieces", () => {
    expect(occupiedZones([stepWith([])]).size).toBe(0);
  });
});
