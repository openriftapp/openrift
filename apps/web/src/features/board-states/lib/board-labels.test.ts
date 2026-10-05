import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import {
  chainEntryLabel,
  describeArrow,
  describeArrowEnd,
  describeZone,
  pieceName,
} from "./board-labels";

const yasuo: BoardPiece = {
  id: "p1",
  owner: "A",
  zone: { kind: "battlefield", index: 0 },
  kind: "unit",
  card: { cardId: "00000000-0000-7000-8000-000000000001", name: "Yasuo, Remorseful" },
  exhausted: false,
  facedown: false,
  keywords: [],
  damage: 0,
  might: 0,
  buffs: 0,
  highlight: false,
};

const step: BoardStep = {
  ...emptyBoardStep(2),
  pieces: [yasuo],
  chain: [
    { id: "c1", owner: "B", type: "spell", label: "Hypothetical spell" },
    { id: "c2", owner: "A", type: "triggered", source: "p1" },
  ],
};

describe("pieceName", () => {
  it("uses the card name, else the piece kind", () => {
    expect(pieceName(yasuo)).toBe("Yasuo, Remorseful");
    expect(pieceName({ ...yasuo, card: null, kind: "token" })).toBe("Token");
  });
});

describe("describeZone", () => {
  it("numbers battlefields from one", () => {
    expect(describeZone({ kind: "battlefield", index: 0 })).toBe("Battlefield 1");
  });

  it("leaves a seat zone without an owner bare", () => {
    expect(describeZone({ kind: "base" })).toBe("Base");
  });

  it("names a facedown zone after its battlefield without an owner", () => {
    expect(describeZone({ kind: "facedown", index: 1 })).toBe("Facedown · Battlefield 2");
  });

  it("appends the owner to a player zone", () => {
    expect(describeZone({ kind: "banishment" }, "B")).toBe("Banishment B");
  });
});

describe("chainEntryLabel", () => {
  it("prefers the label, then the source card", () => {
    expect(chainEntryLabel(step.chain[0]!, step.pieces)).toBe("Hypothetical spell");
    expect(chainEntryLabel(step.chain[1]!, step.pieces)).toBe("Yasuo, Remorseful");
  });

  it("falls back to the entry type when nothing names it", () => {
    expect(chainEntryLabel({ id: "c3", owner: "A", type: "activated", source: "p9" }, [])).toBe(
      "Activated ability",
    );
  });
});

describe("describeArrowEnd", () => {
  it("describes a piece with its owner", () => {
    expect(describeArrowEnd({ piece: "p1" }, step)).toBe("Yasuo, Remorseful (A)");
  });

  it("describes a chain entry with its position", () => {
    expect(describeArrowEnd({ chain: "c2" }, step)).toBe("Yasuo, Remorseful (#2)");
  });

  it("describes a zone, dropping the owner for a facedown zone", () => {
    expect(describeArrowEnd({ zone: { kind: "base" }, owner: "A" }, step)).toBe("Base A");
    expect(describeArrowEnd({ zone: { kind: "facedown", index: 0 }, owner: "A" }, step)).toBe(
      "Facedown · Battlefield 1",
    );
  });
});

describe("describeArrow", () => {
  it("names the kind and both ends", () => {
    expect(
      describeArrow(
        { kind: "recall", from: { piece: "p1" }, to: { zone: { kind: "base" }, owner: "A" } },
        step,
      ),
    ).toBe("Recall: Yasuo, Remorseful (A) → Base A");
  });
});
