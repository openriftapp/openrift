import { describe, expect, it } from "vitest";

import type { BoardChainEntry, BoardDocument, BoardPiece, BoardStep } from "./board-state.js";
import {
  boardDocumentSchema,
  boardStateSummary,
  CAPTION_REF_PATTERN,
  captionRefFromMatch,
  emptyBoardDocument,
  emptyBoardStep,
  extractCardRefs,
  extractRuleRefs,
  sameZone,
  shownBattlefields,
  upgradeBoardDocument,
} from "./board-state.js";

const CARD_ID = "00000000-0000-7000-8000-000000000001";

function piece(overrides: Partial<BoardPiece> = {}): BoardPiece {
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

function chainEntry(overrides: Partial<BoardChainEntry> = {}): BoardChainEntry {
  return { id: "c1", owner: "A", type: "spell", label: "Hypothetical spell", ...overrides };
}

function docWith(
  pieces: BoardPiece[],
  overrides: Partial<BoardDocument> = {},
  stepOverrides: Partial<BoardStep> = {},
): BoardDocument {
  const doc = { ...emptyBoardDocument(), ...overrides };
  return {
    ...doc,
    steps: [{ ...emptyBoardStep(doc.battlefields.length), pieces, ...stepOverrides }],
  };
}

function valid(doc: BoardDocument): boolean {
  return boardDocumentSchema.safeParse(doc).success;
}

describe("boardDocumentSchema", () => {
  it("accepts the empty document", () => {
    expect(valid(emptyBoardDocument())).toBe(true);
  });

  it("accepts a four-player board with three battlefields and arrows", () => {
    const doc = docWith(
      [
        piece({ id: "a", zone: { kind: "battlefield", index: 2 } }),
        piece({ id: "d", owner: "D", keywords: ["Stun"], label: "Hidden" }),
      ],
      { playerCount: 4, battlefields: [{ card: null }, { card: null }, { card: null }] },
      {
        arrows: [
          {
            kind: "move",
            from: { piece: "d" },
            to: { zone: { kind: "battlefield", index: 0 }, owner: "D" },
          },
          { kind: "target", from: { piece: "a" }, to: { piece: "d" } },
        ],
      },
    );
    expect(valid(doc)).toBe(true);
  });

  it("rejects a piece owned by a player outside the game", () => {
    expect(valid(docWith([piece({ owner: "C" })]))).toBe(false);
  });

  it("rejects a piece on a battlefield that does not exist", () => {
    expect(valid(docWith([piece({ zone: { kind: "battlefield", index: 2 } })]))).toBe(false);
  });

  it("rejects a piece in the facedown zone of a battlefield that does not exist", () => {
    expect(valid(docWith([piece({ zone: { kind: "facedown", index: 2 }, facedown: true })]))).toBe(
      false,
    );
  });

  it("accepts several pieces in one facedown zone", () => {
    const zone = { kind: "facedown", index: 0 } as const;
    expect(valid(docWith([piece({ zone }), piece({ id: "p2", zone })]))).toBe(true);
  });

  it("accepts pieces in banishment and both decks", () => {
    const pieces = [
      piece({ zone: { kind: "banishment" } }),
      piece({ id: "p2", zone: { kind: "deck" }, facedown: true }),
      piece({ id: "p3", kind: "rune", zone: { kind: "runeDeck" }, facedown: true }),
    ];
    expect(valid(docWith(pieces))).toBe(true);
  });

  it("rejects duplicate piece ids within a step", () => {
    expect(valid(docWith([piece(), piece()]))).toBe(false);
  });

  it("rejects an arrow pointing at a missing piece", () => {
    const doc = docWith(
      [piece()],
      {},
      {
        arrows: [{ kind: "target", from: { piece: "p1" }, to: { piece: "nope" } }],
      },
    );
    expect(valid(doc)).toBe(false);
  });

  it("rejects more than three battlefields", () => {
    const doc = docWith([], { battlefields: Array.from({ length: 4 }, () => ({ card: null })) });
    expect(valid(doc)).toBe(false);
  });

  it("rejects a document without steps", () => {
    expect(valid({ ...emptyBoardDocument(), steps: [] })).toBe(false);
  });
});

describe("piece marks", () => {
  it("rejects duplicate keywords on one piece", () => {
    expect(valid(docWith([piece({ keywords: ["Stun", "Stun"] })]))).toBe(false);
  });

  it("rejects more than six keywords", () => {
    expect(valid(docWith([piece({ keywords: ["a", "b", "c", "d", "e", "f", "g"] })]))).toBe(false);
  });

  it("accepts a negative might modifier", () => {
    expect(valid(docWith([piece({ might: -3 })]))).toBe(true);
  });

  it("rejects a might modifier outside the range", () => {
    expect(valid(docWith([piece({ might: -100 })]))).toBe(false);
    expect(valid(docWith([piece({ might: 100 })]))).toBe(false);
  });

  it("accepts more than one buff and a labelled counter", () => {
    expect(valid(docWith([piece({ buffs: 2, counter: { value: 3, label: "Charge" } })]))).toBe(
      true,
    );
  });

  it("rejects a negative buff count", () => {
    expect(valid(docWith([piece({ buffs: -1 })]))).toBe(false);
  });
});

describe("chain entries", () => {
  it("accepts a label-only entry and an ability linked to its source piece", () => {
    const doc = docWith(
      [piece()],
      {},
      {
        chain: [chainEntry(), chainEntry({ id: "c2", type: "triggered", source: "p1" })],
      },
    );
    expect(valid(doc)).toBe(true);
  });

  it("rejects an entry with neither label, card nor source", () => {
    const doc = docWith([], {}, { chain: [{ id: "c1", owner: "A", type: "spell" }] });
    expect(valid(doc)).toBe(false);
  });

  it("rejects an entry whose source piece is missing", () => {
    const doc = docWith([], {}, { chain: [chainEntry({ source: "p9" })] });
    expect(valid(doc)).toBe(false);
  });

  it("rejects duplicate entry ids", () => {
    const doc = docWith([], {}, { chain: [chainEntry(), chainEntry()] });
    expect(valid(doc)).toBe(false);
  });

  it("accepts a target arrow from an entry to a piece and from an entry to an entry", () => {
    const doc = docWith(
      [piece()],
      {},
      {
        chain: [chainEntry(), chainEntry({ id: "c2", owner: "B" })],
        arrows: [
          { kind: "target", from: { chain: "c1" }, to: { piece: "p1" } },
          { kind: "target", from: { chain: "c2" }, to: { chain: "c1" } },
        ],
      },
    );
    expect(valid(doc)).toBe(true);
  });

  it("rejects a move arrow from a chain entry", () => {
    const doc = docWith(
      [],
      {},
      {
        chain: [chainEntry()],
        arrows: [
          { kind: "move", from: { chain: "c1" }, to: { zone: { kind: "base" }, owner: "A" } },
        ],
      },
    );
    expect(valid(doc)).toBe(false);
  });

  it("rejects an arrow to a missing chain entry", () => {
    const doc = docWith(
      [piece()],
      {},
      {
        arrows: [{ kind: "target", from: { piece: "p1" }, to: { chain: "c1" } }],
      },
    );
    expect(valid(doc)).toBe(false);
  });
});

describe("recall arrows", () => {
  const unit = piece({ zone: { kind: "battlefield", index: 0 } });

  it("accepts a recall to the owner's base", () => {
    const doc = docWith(
      [unit],
      {},
      {
        arrows: [
          { kind: "recall", from: { piece: "p1" }, to: { zone: { kind: "base" }, owner: "A" } },
        ],
      },
    );
    expect(valid(doc)).toBe(true);
  });

  it("rejects a recall to another player's base", () => {
    const doc = docWith(
      [unit],
      {},
      {
        arrows: [
          { kind: "recall", from: { piece: "p1" }, to: { zone: { kind: "base" }, owner: "B" } },
        ],
      },
    );
    expect(valid(doc)).toBe(false);
  });

  it("rejects a recall to a battlefield", () => {
    const doc = docWith(
      [unit],
      {},
      {
        arrows: [
          {
            kind: "recall",
            from: { piece: "p1" },
            to: { zone: { kind: "battlefield", index: 1 }, owner: "A" },
          },
        ],
      },
    );
    expect(valid(doc)).toBe(false);
  });
});

describe("step state", () => {
  it("accepts turn, player stats and battlefield state", () => {
    const doc = docWith(
      [],
      {},
      {
        turn: { player: "A", phase: "main", state: "showdown-open", priority: "B", focus: "A" },
        players: { A: { score: 7, xp: 3, energy: 2, power: { fury: 1 }, deckCount: 20 } },
        battlefields: [
          { controller: "A", contested: true, scoredBy: ["A"], encounter: "combat" },
          { controller: null, contested: false, scoredBy: [], encounter: null },
        ],
      },
    );
    expect(valid(doc)).toBe(true);
  });

  it("rejects a turn player outside the game", () => {
    expect(valid(docWith([], {}, { turn: { priority: "C" } }))).toBe(false);
  });

  it("rejects stats for a player outside the game", () => {
    expect(valid(docWith([], {}, { players: { D: { score: 1 } } }))).toBe(false);
  });

  it("rejects battlefield state that does not match the battlefield count", () => {
    expect(valid(docWith([], {}, { battlefields: [] }))).toBe(false);
  });

  it("rejects a duplicate scorer on one battlefield", () => {
    const doc = docWith(
      [],
      {},
      {
        battlefields: [
          { controller: null, contested: false, scoredBy: ["A", "A"], encounter: null },
          { controller: null, contested: false, scoredBy: [], encounter: null },
        ],
      },
    );
    expect(valid(doc)).toBe(false);
  });

  it("allows team scoring only with four players", () => {
    expect(valid(docWith([], { scoring: "teams" }))).toBe(false);
    expect(valid(docWith([], { scoring: "teams", playerCount: 4 }))).toBe(true);
  });

  it("rejects a score on C or D in team scoring", () => {
    const doc = docWith([], { scoring: "teams", playerCount: 4 }, { players: { C: { score: 2 } } });
    expect(valid(doc)).toBe(false);
  });
});

describe("sameZone", () => {
  it("tells battlefields and facedown zones apart by index", () => {
    expect(sameZone({ kind: "facedown", index: 0 }, { kind: "facedown", index: 0 })).toBe(true);
    expect(sameZone({ kind: "facedown", index: 0 }, { kind: "facedown", index: 1 })).toBe(false);
    expect(sameZone({ kind: "facedown", index: 0 }, { kind: "battlefield", index: 0 })).toBe(false);
    expect(sameZone({ kind: "deck" }, { kind: "deck" })).toBe(true);
  });
});

describe("shownBattlefields", () => {
  it("keeps every battlefield when none is used", () => {
    expect(shownBattlefields(docWith([piece()]))).toEqual([0, 1]);
  });

  it("drops a battlefield that stays empty in every step", () => {
    const doc = docWith([piece({ zone: { kind: "battlefield", index: 1 } })]);
    expect(shownBattlefields(doc)).toEqual([1]);
  });

  it("counts a facedown card as using its battlefield", () => {
    const doc = docWith([piece({ zone: { kind: "facedown", index: 0 } })]);
    expect(shownBattlefields(doc)).toEqual([0]);
  });

  it("counts a piece in any step", () => {
    const doc = docWith([]);
    doc.steps.push({
      ...emptyBoardStep(2),
      pieces: [piece({ zone: { kind: "battlefield", index: 1 } })],
    });
    expect(shownBattlefields(doc)).toEqual([1]);
  });

  it("counts an arrow into a battlefield", () => {
    const doc = docWith(
      [piece()],
      {},
      {
        arrows: [
          {
            kind: "move",
            from: { piece: "p1" },
            to: { zone: { kind: "battlefield", index: 0 }, owner: "A" },
          },
        ],
      },
    );
    expect(shownBattlefields(doc)).toEqual([0]);
  });

  it("counts battlefield state such as a controller", () => {
    const step = emptyBoardStep(2);
    step.battlefields[1] = { ...step.battlefields[1]!, controller: "B" };
    const doc = docWith([], {}, { battlefields: step.battlefields });
    expect(shownBattlefields(doc)).toEqual([1]);
  });
});

describe("upgradeBoardDocument", () => {
  function v1Document(pieceOverrides: Record<string, unknown> = {}): Record<string, unknown> {
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

  function v2Document(): Record<string, unknown> {
    return {
      schemaVersion: 2,
      playerCount: 2,
      battlefields: [{ card: null }, { card: null }],
      zones: {
        base: true,
        legend: true,
        champion: true,
        runes: true,
        hand: false,
        trash: false,
        deck: true,
        chain: true,
      },
      steps: [
        {
          caption: "[[card:p1]] attacks",
          pieces: [
            {
              id: "p1",
              owner: "A",
              zone: { kind: "battlefield", index: 1 },
              kind: "unit",
              card: null,
              exhausted: true,
              keywords: ["Stun"],
              damage: 1,
              might: 2,
              highlight: false,
            },
            {
              id: "p2",
              owner: "B",
              zone: { kind: "base" },
              kind: "unit",
              card: null,
              exhausted: false,
              keywords: [],
              damage: 0,
              might: 0,
              highlight: true,
            },
          ],
          chain: [{ owner: "B", card: { cardId: CARD_ID, name: "Flash Freeze" } }],
          arrows: [
            { kind: "target", from: "p2", to: { piece: "p1" } },
            { kind: "move", from: "p1", to: { zone: { kind: "base" }, owner: "A" } },
          ],
        },
      ],
    };
  }

  it("converts a v1 document to v3", () => {
    const upgraded = upgradeBoardDocument(v1Document());
    expect(upgraded?.schemaVersion).toBe(3);
    expect(upgraded?.scoring).toBe("players");
    expect(upgraded?.zones).toMatchObject({ deck: false, banishment: false, score: false });
    expect(upgraded?.steps[0]?.pieces[0]).toMatchObject({
      keywords: [],
      might: 0,
      facedown: false,
      buffs: 0,
    });
    expect(upgraded?.steps[0]?.battlefields).toHaveLength(1);
  });

  it("keeps v1 chain text as a label", () => {
    const doc = v1Document() as { steps: { chain: unknown[] }[] };
    doc.steps[0]!.chain = [
      { owner: "A", text: "Casts a spell", card: null },
      { owner: "B", text: "Flash Freeze", card: { cardId: CARD_ID, name: "Flash Freeze" } },
      { owner: "B", text: "  ", card: null },
    ];
    expect(upgradeBoardDocument(doc)?.steps[0]?.chain).toEqual([
      { id: "c1", owner: "A", type: "spell", label: "Casts a spell" },
      { id: "c2", owner: "B", type: "spell", card: { cardId: CARD_ID, name: "Flash Freeze" } },
    ]);
  });

  it("turns a stunned v1 piece into a Stun keyword and buff into might", () => {
    const upgraded = upgradeBoardDocument(v1Document({ stunned: true, buff: 4 }));
    expect(upgraded?.steps[0]?.pieces[0]).toMatchObject({ keywords: ["Stun"], might: 4, buffs: 0 });
  });

  it("converts a v2 document with chain entries and arrows to v3", () => {
    const upgraded = upgradeBoardDocument(v2Document());
    const step = upgraded?.steps[0];
    expect(upgraded?.zones.deck).toBe(true);
    expect(step?.chain).toEqual([
      { id: "c1", owner: "B", type: "spell", card: { cardId: CARD_ID, name: "Flash Freeze" } },
    ]);
    expect(step?.arrows).toEqual([
      { kind: "target", from: { piece: "p2" }, to: { piece: "p1" } },
      { kind: "move", from: { piece: "p1" }, to: { zone: { kind: "base" }, owner: "A" } },
    ]);
    expect(step?.pieces[0]).toMatchObject({ might: 2, damage: 1, facedown: false, buffs: 0 });
    expect(step?.battlefields).toHaveLength(2);
    expect(step?.turn).toEqual({});
  });

  it("passes a v3 document through unchanged", () => {
    const doc = emptyBoardDocument();
    expect(upgradeBoardDocument(doc)).toEqual(doc);
  });

  it("returns null for anything invalid", () => {
    expect(upgradeBoardDocument(null)).toBeNull();
    expect(upgradeBoardDocument({ schemaVersion: 1 })).toBeNull();
    expect(upgradeBoardDocument({ ...emptyBoardDocument(), steps: [] })).toBeNull();
  });
});

describe("caption references", () => {
  it("returns unique piece ids in order", () => {
    expect(extractCardRefs("[[card:p2]] hits [[card:p1]] and [[card:p2]] again")).toEqual([
      "p2",
      "p1",
    ]);
  });

  it("ignores malformed card references", () => {
    expect(extractCardRefs("[[card:]] [[card:P1]] [card:p1]")).toEqual([]);
  });

  it("matches rule, card and chain references with one pattern", () => {
    const refs = [
      ..."[[460.3]] [[t:118]] [[card:p1]] [[chain:c2]] [[466.1.a.2]]".matchAll(CAPTION_REF_PATTERN),
    ].map((match) => captionRefFromMatch(match));
    expect(refs).toEqual([
      { kind: "rule", ref: { kind: "core", ruleNumber: "460.3" } },
      { kind: "rule", ref: { kind: "tournament", ruleNumber: "118" } },
      { kind: "card", pieceId: "p1" },
      { kind: "chain", entryId: "c2" },
      { kind: "rule", ref: { kind: "core", ruleNumber: "466.1.a.2" } },
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

  it("reads lettered sub-rules", () => {
    expect(extractRuleRefs("[[383.2.c.2]] [[t:103.1.b]] [[103.1.a.1.b.2]]")).toEqual([
      { kind: "core", ruleNumber: "383.2.c.2" },
      { kind: "tournament", ruleNumber: "103.1.b" },
      { kind: "core", ruleNumber: "103.1.a.1.b.2" },
    ]);
  });

  it("ignores malformed and uppercase references", () => {
    expect(extractRuleRefs("[[abc]] [460.3] [[ 460 ]] [[x:1]] [[466.1.A.2]] [[466.ab]]")).toEqual(
      [],
    );
  });
});

describe("boardStateSummary", () => {
  function withCaptions(...captions: string[]): BoardDocument {
    const drake = piece({
      id: "p1",
      card: { cardId: "019a0000-0000-7000-8000-000000000001", name: "Mountain Drake" },
    });
    const token = piece({ id: "p2", kind: "token" });
    return {
      ...emptyBoardDocument(),
      steps: captions.map((caption) => ({
        ...emptyBoardStep(2),
        caption,
        pieces: [drake, token],
        chain: [
          chainEntry({ id: "c1", label: undefined, type: "triggered", source: "p1" }),
          chainEntry({ id: "c2" }),
        ],
      })),
    };
  }

  it("resolves chain references to the entry's name", () => {
    expect(boardStateSummary(withCaptions("[[chain:c1]] resolves before [[chain:c2]]."))).toBe(
      "Mountain Drake resolves before Hypothetical spell.",
    );
  });

  it("uses the last step's caption", () => {
    expect(boardStateSummary(withCaptions("Setup.", "The Drake survives."))).toBe(
      "The Drake survives.",
    );
  });

  it("resolves card and rule references to plain text", () => {
    expect(
      boardStateSummary(
        withCaptions("[[card:p1]] and a [[card:p2]] survive, see [[460.3]] and [[t:118]]."),
      ),
    ).toBe("Mountain Drake and a Token survive, see § 460.3 and § T 118.");
  });

  it("drops references to pieces that are not in the last step", () => {
    expect(boardStateSummary(withCaptions("[[card:p9]] left.\n\nDone."))).toBe("left. Done.");
  });

  it("returns null for an empty last caption", () => {
    expect(boardStateSummary(withCaptions("Setup.", "  \n "))).toBeNull();
  });
});
