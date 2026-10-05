import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardDocument, emptyBoardStep } from "@openrift/shared/board-state";
import type { Card } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import {
  arrowZoneKey,
  boardWidthUnits,
  grantedLegendSlots,
  hasTurnState,
  isHiddenZone,
  longestChain,
  nextChainId,
  nextPieceId,
  occupiedZones,
  pieceKindForCardTypes,
  pieceNumerals,
  piecesAt,
  scoreHolder,
  seatSlots,
  seatsFor,
  zoneAcceptsMore,
  zoneCardRule,
} from "./board-layout";

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

describe("isHiddenZone", () => {
  it("hides both decks and the facedown zones", () => {
    expect(isHiddenZone({ kind: "deck" })).toBe(true);
    expect(isHiddenZone({ kind: "runeDeck" })).toBe(true);
    expect(isHiddenZone({ kind: "facedown", index: 0 })).toBe(true);
    expect(isHiddenZone({ kind: "banishment" })).toBe(false);
    expect(isHiddenZone({ kind: "battlefield", index: 0 })).toBe(false);
  });
});

describe("hasTurnState", () => {
  it("is false only while every turn field is unset", () => {
    expect(hasTurnState({})).toBe(false);
    expect(hasTurnState({ phase: "main" })).toBe(true);
  });
});

describe("scoreHolder", () => {
  it("returns the player itself outside team scoring", () => {
    expect(scoreHolder("C", "players")).toBe("C");
  });

  it("maps teammates onto A and B in team scoring", () => {
    expect(scoreHolder("A", "teams")).toBe("A");
    expect(scoreHolder("C", "teams")).toBe("A");
    expect(scoreHolder("B", "teams")).toBe("B");
    expect(scoreHolder("D", "teams")).toBe("B");
  });
});

describe("nextChainId", () => {
  it("returns the lowest unused chain id", () => {
    expect(nextChainId([])).toBe("c1");
    expect(
      nextChainId([
        { id: "c1", owner: "A", type: "spell", label: "x" },
        { id: "c3", owner: "A", type: "spell", label: "y" },
      ]),
    ).toBe("c2");
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

describe("zoneCardRule", () => {
  const rune: Pick<Card, "types" | "superTypes"> = { types: ["rune"], superTypes: [] };
  const champion: Pick<Card, "types" | "superTypes"> = {
    types: ["unit"],
    superTypes: ["champion"],
  };
  const unit: Pick<Card, "types" | "superTypes"> = { types: ["unit"], superTypes: [] };

  it("limits the rune zone to rune cards and generic runes", () => {
    const rule = zoneCardRule({ kind: "runes" });
    expect(rule?.cardFilter(rune)).toBe(true);
    expect(rule?.cardFilter(unit)).toBe(false);
    expect(rule?.kinds).toEqual(["rune"]);
  });

  it("limits the champion zone to champion units", () => {
    const rule = zoneCardRule({ kind: "champion" });
    expect(rule?.cardFilter(champion)).toBe(true);
    expect(rule?.cardFilter(unit)).toBe(false);
    expect(rule?.kinds).toEqual(["unit"]);
  });

  it("limits battlefield seats to units without capping them", () => {
    const rule = zoneCardRule({ kind: "battlefield", index: 0 });
    expect(rule?.cardFilter(unit)).toBe(true);
    expect(rule?.cardFilter(champion)).toBe(true);
    expect(rule?.cardFilter(rune)).toBe(false);
    expect(rule?.kinds).toEqual(["unit", "token"]);
    expect(zoneAcceptsMore({ kind: "battlefield", index: 0 }, 40)).toBe(true);
  });

  it("hides the add slot once a zone holds its usual complement", () => {
    expect(zoneAcceptsMore({ kind: "legend" }, 0)).toBe(true);
    expect(zoneAcceptsMore({ kind: "legend" }, 1)).toBe(false);
    expect(zoneAcceptsMore({ kind: "runes" }, 11)).toBe(true);
    expect(zoneAcceptsMore({ kind: "runes" }, 12)).toBe(false);
    expect(zoneAcceptsMore({ kind: "base" }, 40)).toBe(true);
  });

  it("widens the legend zone by the granted slots", () => {
    expect(zoneAcceptsMore({ kind: "legend" }, 1, 1)).toBe(true);
    expect(zoneAcceptsMore({ kind: "legend" }, 2, 1)).toBe(false);
  });

  it("offers one card for a facedown zone without restricting the card", () => {
    const rule = zoneCardRule({ kind: "facedown", index: 0 });
    expect(rule?.cardFilter(rune)).toBe(true);
    expect(zoneAcceptsMore({ kind: "facedown", index: 0 }, 0)).toBe(true);
    expect(zoneAcceptsMore({ kind: "facedown", index: 0 }, 1)).toBe(false);
  });

  it("leaves open zones unrestricted", () => {
    expect(zoneCardRule({ kind: "base" })).toBeNull();
    expect(zoneCardRule({ kind: "hand" })).toBeNull();
  });
});

describe("grantedLegendSlots", () => {
  const NEEKO = "00000000-0000-7000-8000-00000000000a";
  const neeko = (overrides: Partial<BoardPiece>) =>
    piece({ card: { cardId: NEEKO, name: "Neeko" }, ...overrides });
  const grants = (cardId: string) => cardId === NEEKO;

  it("counts each granting card the player has on the base or a battlefield", () => {
    const pieces = [
      neeko({ id: "p1" }),
      neeko({ id: "p2", zone: { kind: "battlefield", index: 1 } }),
      piece({ id: "p3" }),
    ];
    expect(grantedLegendSlots(pieces, "A", grants)).toBe(2);
  });

  it("ignores granting cards off the board or owned by another player", () => {
    const pieces = [
      neeko({ id: "p1", zone: { kind: "hand" } }),
      neeko({ id: "p2", zone: { kind: "trash" } }),
      neeko({ id: "p3", owner: "B" }),
    ];
    expect(grantedLegendSlots(pieces, "A", grants)).toBe(0);
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

describe("longestChain", () => {
  it("returns the longest chain across steps", () => {
    expect(longestChain([stepWith([], 1), stepWith([], 3), stepWith([])])).toBe(3);
  });

  it("returns 0 when no step has a chain", () => {
    expect(longestChain([stepWith([])])).toBe(0);
  });
});

describe("boardWidthUnits", () => {
  const baseAndHand = {
    ...emptyBoardDocument().zones,
    legend: false,
    champion: false,
    runes: false,
    hand: true,
  };

  it("counts zones empty in every step as labels", () => {
    const steps = [stepWith([piece({ id: "p1", owner: "B" })])];
    expect(boardWidthUnits(steps, baseAndHand, seatsFor(2), 0)).toBeCloseTo(3.9);
  });

  it("widens for a crowded battlefield", () => {
    const crowd = ["p1", "p2", "p3", "p4"].map((id) =>
      piece({ id, zone: { kind: "battlefield", index: 0 } }),
    );
    expect(boardWidthUnits([stepWith(crowd)], baseAndHand, seatsFor(2), 2)).toBeCloseTo(6.4);
  });

  it("doubles the seat row when two players share a side", () => {
    const steps = [stepWith([piece({ id: "p1" }), piece({ id: "p2", zone: { kind: "hand" } })])];
    expect(boardWidthUnits(steps, baseAndHand, seatsFor(4), 0)).toBeCloseTo(12);
  });
});
