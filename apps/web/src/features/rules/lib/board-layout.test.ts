import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardDocument } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import {
  arrowZoneKey,
  nextPieceId,
  pieceKindForCardTypes,
  piecesAt,
  playerRows,
  rowIsVisible,
  sameZone,
  seatsFor,
} from "./board-layout";

function piece(overrides: Partial<BoardPiece>): BoardPiece {
  return {
    id: "p1",
    owner: "A",
    zone: { kind: "base" },
    kind: "unit",
    card: null,
    exhausted: false,
    stunned: false,
    damage: 0,
    buff: 0,
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

describe("playerRows", () => {
  it("keeps every slot in place and marks hidden ones", () => {
    const rows = playerRows({ ...emptyBoardDocument().zones, base: true, trash: true });
    expect(rows.near.map((slot) => [slot.kind, slot.visible])).toEqual([
      ["legend", false],
      ["champion", false],
      ["base", true],
    ]);
    expect(rows.far.map((slot) => slot.visible)).toEqual([false, false, true]);
  });

  it("reports a row with no visible zone as hidden", () => {
    const rows = playerRows(emptyBoardDocument().zones);
    expect(rowIsVisible(rows.near)).toBe(true);
    expect(rowIsVisible(rows.far)).toBe(false);
  });
});

describe("sameZone", () => {
  it("compares battlefields by index", () => {
    expect(sameZone({ kind: "battlefield", index: 1 }, { kind: "battlefield", index: 1 })).toBe(
      true,
    );
    expect(sameZone({ kind: "battlefield", index: 0 }, { kind: "battlefield", index: 1 })).toBe(
      false,
    );
  });

  it("never matches a battlefield with a player zone", () => {
    expect(sameZone({ kind: "battlefield", index: 0 }, { kind: "base" })).toBe(false);
  });
});

describe("piecesAt", () => {
  const step: BoardStep = {
    caption: "",
    chain: [],
    arrows: [],
    pieces: [
      piece({ id: "a", zone: { kind: "battlefield", index: 0 } }),
      piece({ id: "b", owner: "B", zone: { kind: "battlefield", index: 0 } }),
      piece({ id: "c", owner: "B", zone: { kind: "base" } }),
    ],
  };

  it("filters by zone", () => {
    expect(piecesAt(step, { kind: "battlefield", index: 0 }).map((p) => p.id)).toEqual(["a", "b"]);
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
});

describe("pieceKindForCardTypes", () => {
  it("maps the first known card type", () => {
    expect(pieceKindForCardTypes(["unit"])).toBe("unit");
    expect(pieceKindForCardTypes(["battlefield", "gear"])).toBe("gear");
  });

  it("falls back to a token for unknown types", () => {
    expect(pieceKindForCardTypes(["battlefield"])).toBe("token");
    expect(pieceKindForCardTypes([])).toBe("token");
  });
});

describe("nextPieceId", () => {
  it("returns the lowest unused id", () => {
    expect(nextPieceId([])).toBe("p1");
    expect(nextPieceId([piece({ id: "p1" }), piece({ id: "p3" })])).toBe("p2");
  });
});
