import { seatsFor } from "@openrift/shared/board-layout";
import type { BoardPiece, BoardStep } from "@openrift/shared/board-state";
import { emptyBoardDocument, emptyBoardStep } from "@openrift/shared/board-state";
import type { Card } from "@openrift/shared/types/catalog";
import { describe, expect, it } from "vitest";

import {
  boardWidthUnits,
  grantedLegendSlots,
  hasTurnState,
  isHiddenZone,
  longestChain,
  nextChainId,
  nextPieceId,
  pieceKindForCardTypes,
  runePoolUnits,
  runeZoneMinWidth,
  scoreHolder,
  zoneAcceptsMore,
  zoneCardRule,
} from "./board-rules";

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

describe("longestChain", () => {
  it("returns the longest chain across steps", () => {
    expect(longestChain([stepWith([], 1), stepWith([], 3), stepWith([])])).toBe(3);
  });

  it("returns 0 when no step has a chain", () => {
    expect(longestChain([stepWith([])])).toBe(0);
  });
});

describe("runePoolUnits", () => {
  const rune = (id: string, exhausted = false) =>
    piece({ id, kind: "rune", zone: { kind: "runes" }, exhausted });

  it("lets each upright rune after the first show a sliver of the one beneath", () => {
    expect(runePoolUnits([rune("r1"), rune("r2"), rune("r3")])).toBeCloseTo(1.64);
  });

  it("counts a turned rune at its sideways width", () => {
    expect(runePoolUnits([rune("r1"), rune("r2", true)])).toBeCloseTo(1.72);
    expect(runePoolUnits([rune("r1", true), rune("r2", true)])).toBeCloseTo(1.72);
  });

  it("is zero for an empty pool", () => {
    expect(runePoolUnits([])).toBe(0);
  });

  it("ends at the sideways width of the last turned rune", () => {
    const pool = [rune("r1"), rune("r2"), rune("r3", true), rune("r4", true), rune("r5", true)];
    expect(runePoolUnits(pool)).toBeCloseTo(4 * 0.32 + 1.4);
  });

  it("covers a pool of twelve with every other rune turned", () => {
    const pool = Array.from({ length: 12 }, (_, index) => rune(`r${index}`, index % 2 === 1));
    expect(runePoolUnits(pool)).toBeCloseTo(11 * 0.32 + 1.4);
  });
});

describe("runeZoneMinWidth", () => {
  const rune = (id: string, exhausted = false) =>
    piece({ id, kind: "rune", zone: { kind: "runes" }, exhausted });

  it("keeps the usual width for a small pool", () => {
    expect(runeZoneMinWidth([rune("r1")])).toBe("calc(var(--board-card-w) * 2 + 2rem)");
  });

  it("grows to fit a pool that ends on a turned rune", () => {
    const pool = [rune("r1"), rune("r2"), rune("r3", true), rune("r4", true), rune("r5", true)];
    expect(runeZoneMinWidth(pool)).toBe("calc(var(--board-card-w) * 2.68 + 2rem)");
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
    expect(boardWidthUnits(steps, baseAndHand, seatsFor(2), [])).toBeCloseTo(3.9);
  });

  it("widens for a crowded battlefield", () => {
    const crowd = ["p1", "p2", "p3", "p4"].map((id) =>
      piece({ id, zone: { kind: "battlefield", index: 0 } }),
    );
    expect(boardWidthUnits([stepWith(crowd)], baseAndHand, seatsFor(2), [0, 1])).toBeCloseTo(6.4);
  });

  it("measures only the battlefields it is given", () => {
    const crowd = ["p1", "p2", "p3", "p4"].map((id) =>
      piece({ id, zone: { kind: "battlefield", index: 1 } }),
    );
    expect(boardWidthUnits([stepWith(crowd)], baseAndHand, seatsFor(2), [0])).toBeCloseTo(1.8);
    expect(boardWidthUnits([stepWith(crowd)], baseAndHand, seatsFor(2), [1])).toBeCloseTo(4.8);
  });

  it("widens the rune zone to the widest pool of turned runes", () => {
    const zones = { ...baseAndHand, runes: true, hand: false };
    const pool = Array.from({ length: 8 }, (_, index) =>
      piece({ id: `r${index}`, kind: "rune", zone: { kind: "runes" }, exhausted: true }),
    );
    const plain = boardWidthUnits([stepWith([])], zones, seatsFor(4), []);
    const crowded = boardWidthUnits([stepWith(pool)], zones, seatsFor(4), []);
    expect(crowded - plain).toBeCloseTo(2 * (runePoolUnits(pool) + 0.4 - 0.9));
  });

  it("doubles the seat row when two players share a side", () => {
    const steps = [stepWith([piece({ id: "p1" }), piece({ id: "p2", zone: { kind: "hand" } })])];
    expect(boardWidthUnits(steps, baseAndHand, seatsFor(4), [])).toBeCloseTo(12);
  });
});
