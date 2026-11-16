import type { BoardDocument, BoardPiece } from "@openrift/shared/board-state";
import { emptyBoardDocument, emptyBoardStep } from "@openrift/shared/board-state";
import { describe, expect, it } from "vitest";

import { defaultIo } from "../../../io.js";
import { textsOf } from "../../../test/share-image-tree.js";
import {
  boardStateImage,
  boardStateTree,
  chainEntryText,
  keywordsFit,
  pieceText,
  readableBadges,
  renderBoardStateImage,
  wrappedLineCount,
  wrappedName,
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
    facedown: false,
    keywords: [],
    damage: 0,
    might: 0,
    buffs: 0,
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
  banishment: true,
  deck: true,
  chain: true,
  score: true,
};

describe("chainEntryText", () => {
  const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Yasuo, Remorseful" };

  it("prefers the label, then the card, then the source piece's card, then the type label", () => {
    const source = piece({ id: "p1", card });
    expect(
      chainEntryText(
        { id: "c1", owner: "A", type: "triggered", label: "Attack trigger", source: "p1" },
        [source],
      ),
    ).toBe("Attack trigger");
    expect(chainEntryText({ id: "c1", owner: "A", type: "spell", card }, [])).toBe(
      "Yasuo, Remorseful",
    );
    expect(
      chainEntryText({ id: "c1", owner: "A", type: "triggered", source: "p1" }, [source]),
    ).toBe("Yasuo, Remorseful");
    expect(chainEntryText({ id: "c1", owner: "A", type: "activated", source: "p9" }, [])).toBe(
      "Activated ability",
    );
  });
});

describe("pieceText", () => {
  it("names a piece by its card, else by its kind label, never by its badge label", () => {
    const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Jinx" };
    expect(pieceText(piece({ card, label: "x" }), 20)).toBe("Jinx");
    expect(pieceText(piece({ label: "Copy" }), 20)).toBe("Unit");
    expect(pieceText(piece({ kind: "token" }), 20)).toBe("Token");
  });
});

describe("readableBadges", () => {
  it("keeps a tag that fits and elides one that keeps five letters", () => {
    expect(readableBadges(piece({ label: "Copy", keywords: ["Deflect"] }), 6)).toEqual([
      "Copy",
      "Defle…",
    ]);
  });

  it("drops a tag that would shrink below a recognisable stem", () => {
    expect(readableBadges(piece({ label: "Hidden", keywords: ["Tank"] }), 4)).toEqual(["Tank"]);
  });
});

describe("keywordsFit", () => {
  it("keeps keywords on a full-size tile", () => {
    expect(keywordsFit(piece({ might: -2 }), 72, 13)).toBe(true);
  });

  it("drops keywords when they would squeeze the name off a small tile", () => {
    expect(keywordsFit(piece({ might: -2 }), 48, 9)).toBe(false);
  });

  it("finds room for keywords on a small tile without a stats row", () => {
    expect(keywordsFit(piece(), 48, 9)).toBe(true);
  });
});

describe("wrappedName", () => {
  const card = {
    cardId: "00000000-0000-4000-8000-000000000001",
    name: "Kai'Sa, Daughter of the Void",
  };

  it.each([false, true])(
    "keeps a long name inside the lines left beside stats and keywords (exhausted: %s)",
    (exhausted) => {
      const named = piece({ card, might: 2, keywords: ["Tank"], exhausted });
      const { text, lines, perLine } = wrappedName(named, 96);

      expect(wrappedLineCount(text, perLine)).toBeLessThanOrEqual(lines);
      expect(text === card.name || text.endsWith("…")).toBe(true);
    },
  );

  it("leaves the keyword row out of the count when there are no keywords", () => {
    expect(wrappedName(piece({ card, might: 2 }), 96).lines).toBeGreaterThan(
      wrappedName(piece({ card, might: 2, keywords: ["Tank"] }), 96).lines,
    );
  });
});

describe("wrappedLineCount", () => {
  it("wraps by word and breaks a word longer than a line", () => {
    expect(wrappedLineCount("Darius, Trifarian", 10)).toBe(2);
    expect(wrappedLineCount("Sett, The Boss", 10)).toBe(2);
    expect(wrappedLineCount("Unbreakable", 5)).toBe(3);
  });
});

describe("renderBoardStateImage", () => {
  it("renders a valid PNG at the fitted size for a four-player board", async () => {
    const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Jinx, Loose Cannon" };
    const document = doc({
      playerCount: 4,
      zones: allZones,
      battlefields: [{ card: { ...card, name: "Targon's Peak" } }, { card: null }],
      steps: [
        {
          ...emptyBoardStep(2),
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
            piece({ id: "p5", owner: "C", zone: { kind: "facedown", index: 1 }, facedown: true }),
            piece({ id: "p6", zone: { kind: "deck" }, facedown: true }),
            piece({ id: "p7", owner: "B", zone: { kind: "banishment" }, card }),
          ],
          chain: [
            { id: "c1", owner: "C", type: "spell", card },
            { id: "c2", owner: "A", type: "triggered", source: "p4" },
          ],
          battlefields: [
            { controller: "A", contested: false, scoredBy: [], encounter: null },
            { controller: null, contested: true, scoredBy: [], encounter: "showdown" },
          ],
        },
      ],
    });

    const input = { title: "Summoner Skirmish showdown", document, siteHost: "openrift.app" };
    const png = await renderBoardStateImage(defaultIo, input);
    expect(png.subarray(0, 8)).toEqual(PNG_MAGIC);
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(boardStateImage(input).height);
    expect(meta.height).toBeGreaterThan(630);
    expect(meta.height).toBeLessThanOrEqual(1260);
  });

  it("renders a two-player board at 1200x630", async () => {
    const png = await renderBoardStateImage(defaultIo, { title: "Lethal", document: doc() });
    const meta = await defaultIo.sharp(png).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });
});

describe("boardStateTree canvas", () => {
  const names = ["Darius, Trifarian", "Yasuo, Remorseless", "Sett, The Boss", "Lux, Lady of Light"];

  function crowded(playerCount: number): BoardDocument {
    const owners = (["A", "B", "C", "D"] as const).slice(0, playerCount);
    const pieces = owners.flatMap((owner) => [
      ...names.map((name, index) =>
        piece({
          id: `${owner}-u${index}`,
          owner,
          card: { cardId: `00000000-0000-4000-8000-00000000000${index}`, name },
          exhausted: index === 3,
          might: index % 2 === 0 ? 2 : 0,
          keywords: index < 2 ? ["Tank"] : [],
        }),
      ),
      ...["Fury", "Calm", "Mind", "Body"].map((rune) =>
        piece({ id: `${owner}-${rune}`, owner, kind: "rune", zone: { kind: "runes" } }),
      ),
    ]);
    return doc({
      playerCount,
      zones: { ...allZones, chain: false },
      steps: [{ ...emptyBoardStep(2), pieces }],
    });
  }

  function canvasSize(playerCount: number) {
    const tree = boardStateTree({ title: "Lethal", document: crowded(playerCount) });
    const { width, height } = tree.props.style as Record<string, unknown>;
    return { width, height };
  }

  it("keeps one and two players on the 1200x630 canvas", () => {
    expect(canvasSize(1)).toEqual({ width: 1200, height: 630 });
    expect(canvasSize(2)).toEqual({ width: 1200, height: 630 });
  });

  it.each([3, 4])("fits the canvas of %i players to its content, at most 1260 high", (count) => {
    const { width, height } = canvasSize(count);
    expect(width).toBe(1200);
    expect(height).toBeGreaterThan(630);
    expect(height).toBeLessThanOrEqual(1260);
  });

  it.each([3, 4])("shows typical card names in full on %i seats", (playerCount) => {
    const texts = textsOf(boardStateTree({ title: "Lethal", document: crowded(playerCount) }));
    for (const name of names) {
      expect(texts.filter((text) => text === name)).toHaveLength(playerCount);
    }
    expect(texts.some((text) => text.endsWith("…"))).toBe(false);
  });
});

describe("boardStateTree", () => {
  const card = { cardId: "00000000-0000-4000-8000-000000000001", name: "Fury Rune" };
  const document = doc({
    zones: allZones,
    steps: [
      {
        ...emptyBoardStep(2),
        pieces: [
          piece({ id: "r1", kind: "rune", zone: { kind: "runes" }, card }),
          piece({ id: "r2", kind: "rune", zone: { kind: "runes" }, card }),
        ],
      },
    ],
  });

  it("never numbers runes that share a name", () => {
    const texts = textsOf(boardStateTree({ title: "Lethal", document }));
    expect(texts.filter((text) => text === "1" || text === "2")).toEqual([]);
  });

  it("captions a seat zone with the owner first", () => {
    const texts = textsOf(boardStateTree({ title: "Lethal", document }));
    expect(texts).toContain("A · Runes");
    expect(texts).toContain("B · Hand");
  });

  it("names the owner when there is one and omits the byline otherwise", () => {
    expect(textsOf(boardStateTree({ title: "Lethal", ownerName: "Poro", document }))).toContain(
      "by Poro",
    );
    expect(
      textsOf(boardStateTree({ title: "Lethal", document })).some((text) => text.startsWith("by ")),
    ).toBe(false);
  });
});
