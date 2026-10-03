import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import { describeArrow, describeZone, pieceName } from "./board-labels";

function piece(overrides: Partial<BoardPiece> & { id: string }): BoardPiece {
  return {
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

const drake = piece({
  id: "p1",
  card: { cardId: "019a0000-0000-7000-8000-000000000001", name: "Mountain Drake" },
});
const step: BoardStep = { caption: "", pieces: [drake], chain: [], arrows: [] };

describe("pieceName", () => {
  it("uses the card name, else the piece kind", () => {
    expect(pieceName(drake)).toBe("Mountain Drake");
    expect(pieceName(piece({ id: "p2", kind: "token" }))).toBe("Token");
  });
});

describe("describeZone", () => {
  it("numbers battlefields from one", () => {
    expect(describeZone({ kind: "battlefield", index: 0 })).toBe("Battlefield 1");
  });

  it("appends the owner to a seat zone", () => {
    expect(describeZone({ kind: "hand" }, "B")).toBe("Hand B");
    expect(describeZone({ kind: "base" })).toBe("Base");
  });
});

describe("describeArrow", () => {
  it("names a move into a zone", () => {
    expect(
      describeArrow(
        { kind: "move", from: "p1", to: { zone: { kind: "battlefield", index: 1 }, owner: "A" } },
        step,
      ),
    ).toBe("Move: Mountain Drake (A) → Battlefield 2");
  });

  it("falls back to the piece id for a piece that is gone", () => {
    expect(describeArrow({ kind: "target", from: "p9", to: { piece: "p1" } }, step)).toBe(
      "Target: p9 → Mountain Drake (A)",
    );
  });
});
