import { describe, expect, it } from "vitest";

import type { BoardDocument, BoardPiece } from "./board-state.js";
import {
  boardDocumentSchema,
  CAPTION_REF_PATTERN,
  captionRefFromMatch,
  emptyBoardDocument,
  extractCardRefs,
  extractRuleRefs,
  upgradeBoardDocument,
} from "./board-state.js";

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
        piece({ id: "d", owner: "D", keywords: ["Stun"], label: "Hidden" }),
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
      docWith([piece({ zone: { kind: "battlefield", index: 2 } })]),
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

describe("piece keywords and might", () => {
  it("rejects duplicate keywords on one piece", () => {
    const result = boardDocumentSchema.safeParse(docWith([piece({ keywords: ["Stun", "Stun"] })]));
    expect(result.success).toBe(false);
  });

  it("rejects more than six keywords", () => {
    const keywords = ["a", "b", "c", "d", "e", "f", "g"];
    expect(boardDocumentSchema.safeParse(docWith([piece({ keywords })])).success).toBe(false);
  });

  it("accepts a negative might modifier", () => {
    expect(boardDocumentSchema.safeParse(docWith([piece({ might: -3 })])).success).toBe(true);
  });

  it("rejects a might modifier outside the range", () => {
    expect(boardDocumentSchema.safeParse(docWith([piece({ might: -100 })])).success).toBe(false);
    expect(boardDocumentSchema.safeParse(docWith([piece({ might: 100 })])).success).toBe(false);
  });
});

describe("upgradeBoardDocument", () => {
  function v1Document(pieceOverrides: Record<string, unknown> = {}): unknown {
    return {
      schemaVersion: 1,
      playerCount: 2,
      battlefields: [{ card: null }],
      zones: {
        base: true,
        legend: false,
        champion: false,
        runes: false,
        hand: false,
        trash: false,
        chain: false,
      },
      steps: [
        {
          caption: "",
          pieces: [
            {
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
              ...pieceOverrides,
            },
          ],
          chain: [],
          arrows: [],
        },
      ],
    };
  }

  it("converts a v1 document to v2", () => {
    const upgraded = upgradeBoardDocument(v1Document());
    expect(upgraded?.schemaVersion).toBe(2);
    expect(upgraded?.zones.deck).toBe(false);
    expect(upgraded?.steps[0]?.pieces[0]).toMatchObject({ keywords: [], might: 0 });
  });

  it("keeps only chain entries that name a card", () => {
    const CARD_ID = "00000000-0000-7000-8000-000000000001";
    const doc = v1Document() as { steps: { chain: unknown[] }[] };
    doc.steps[0]!.chain = [
      { owner: "A", text: "Casts a spell", card: null },
      { owner: "B", text: "Flash Freeze", card: { cardId: CARD_ID, name: "Flash Freeze" } },
    ];
    expect(upgradeBoardDocument(doc)?.steps[0]?.chain).toEqual([
      { owner: "B", card: { cardId: CARD_ID, name: "Flash Freeze" } },
    ]);
  });

  it("turns a stunned piece into a Stun keyword and buff into might", () => {
    const upgraded = upgradeBoardDocument(v1Document({ stunned: true, buff: 4 }));
    expect(upgraded?.steps[0]?.pieces[0]).toMatchObject({ keywords: ["Stun"], might: 4 });
  });

  it("passes a v2 document through unchanged", () => {
    const doc = emptyBoardDocument();
    expect(upgradeBoardDocument(doc)).toEqual(doc);
  });

  it("returns null for anything invalid", () => {
    expect(upgradeBoardDocument(null)).toBeNull();
    expect(upgradeBoardDocument({ schemaVersion: 1 })).toBeNull();
    expect(upgradeBoardDocument({ ...emptyBoardDocument(), steps: [] })).toBeNull();
  });
});

describe("card references", () => {
  it("returns unique piece ids in order", () => {
    expect(extractCardRefs("[[card:p2]] hits [[card:p1]] and [[card:p2]] again")).toEqual([
      "p2",
      "p1",
    ]);
  });

  it("ignores malformed card references", () => {
    expect(extractCardRefs("[[card:]] [[card:P1]] [card:p1]")).toEqual([]);
  });

  it("matches rule and card references with one pattern", () => {
    const refs = [..."[[460.3]] [[t:118]] [[card:p1]]".matchAll(CAPTION_REF_PATTERN)].map((match) =>
      captionRefFromMatch(match),
    );
    expect(refs).toEqual([
      { kind: "rule", ref: { kind: "core", ruleNumber: "460.3" } },
      { kind: "rule", ref: { kind: "tournament", ruleNumber: "118" } },
      { kind: "card", pieceId: "p1" },
    ]);
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
