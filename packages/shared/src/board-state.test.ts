import { describe, expect, it } from "vitest";

import type { BoardDocument, BoardPiece } from "./board-state.js";
import { boardDocumentSchema, emptyBoardDocument, extractRuleRefs } from "./board-state.js";

function piece(overrides: Partial<BoardPiece> = {}): BoardPiece {
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

function docWith(pieces: BoardPiece[], overrides: Partial<BoardDocument> = {}): BoardDocument {
  const doc = emptyBoardDocument();
  return { ...doc, ...overrides, steps: [{ caption: "", pieces, chain: [], arrows: [] }] };
}

describe("boardDocumentSchema", () => {
  it("accepts the empty document", () => {
    expect(boardDocumentSchema.safeParse(emptyBoardDocument()).success).toBe(true);
  });

  it("accepts a four-player board with three battlefields and arrows", () => {
    const doc: BoardDocument = {
      ...docWith([
        piece({ id: "a", zone: { kind: "battlefield", index: 2 } }),
        piece({ id: "d", owner: "D", stunned: true, label: "Hidden" }),
      ]),
      playerCount: 4,
      battlefields: [{ card: null }, { card: null }, { card: null }],
    };
    const [step] = doc.steps;
    step!.arrows = [
      { kind: "move", from: "d", to: { zone: { kind: "battlefield", index: 0 }, owner: "D" } },
      { kind: "target", from: "a", to: { piece: "d" } },
    ];
    expect(boardDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects a piece owned by a player outside the game", () => {
    const result = boardDocumentSchema.safeParse(docWith([piece({ owner: "C" })]));
    expect(result.success).toBe(false);
  });

  it("rejects a piece on a battlefield that does not exist", () => {
    const result = boardDocumentSchema.safeParse(
      docWith([piece({ zone: { kind: "battlefield", index: 1 } })]),
    );
    expect(result.success).toBe(false);
  });

  it("rejects duplicate piece ids within a step", () => {
    const result = boardDocumentSchema.safeParse(docWith([piece(), piece()]));
    expect(result.success).toBe(false);
  });

  it("rejects an arrow pointing at a missing piece", () => {
    const doc = docWith([piece()]);
    doc.steps[0]!.arrows = [{ kind: "target", from: "p1", to: { piece: "nope" } }];
    expect(boardDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects more than three battlefields", () => {
    const doc = docWith([], { battlefields: Array.from({ length: 4 }, () => ({ card: null })) });
    expect(boardDocumentSchema.safeParse(doc).success).toBe(false);
  });

  it("rejects a document without steps", () => {
    expect(boardDocumentSchema.safeParse({ ...emptyBoardDocument(), steps: [] }).success).toBe(
      false,
    );
  });
});

describe("extractRuleRefs", () => {
  it("returns unique core references in order", () => {
    expect(extractRuleRefs("See [[460.3]] and [[118]], then [[460.3]] again.")).toEqual([
      { kind: "core", ruleNumber: "460.3" },
      { kind: "core", ruleNumber: "118" },
    ]);
  });

  it("reads t: references as tournament rules", () => {
    expect(extractRuleRefs("[[t:103.2]] [[103.2]] [[t:103.2]]")).toEqual([
      { kind: "tournament", ruleNumber: "103.2" },
      { kind: "core", ruleNumber: "103.2" },
    ]);
  });

  it("ignores malformed references", () => {
    expect(extractRuleRefs("[[abc]] [460.3] [[ 460 ]] [[x:1]]")).toEqual([]);
  });
});
