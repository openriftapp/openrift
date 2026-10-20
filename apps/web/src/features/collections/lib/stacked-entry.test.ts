import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { stackCardName, stackSideForTile, stackSides } from "./stacked-entry";

const bird = stubPrinting({
  printingId: "pair",
  side: 1,
  cardId: "bird",
  card: { ...stubPrinting().card, name: "Bird" },
});
const gold = stubPrinting({
  printingId: "pair",
  side: 2,
  cardId: "gold",
  card: { ...stubPrinting().card, name: "Gold" },
});
const pairStack = { printingId: "pair", printing: bird, sides: [bird, gold], copyIds: ["c1"] };

describe("stackSides", () => {
  it("lists both sides of a double-sided stack", () => {
    expect(stackSides(pairStack)).toEqual([bird, gold]);
  });

  it("falls back to the stack's printing when no sides are set", () => {
    expect(stackSides({ printingId: "pair", printing: bird, copyIds: [] })).toEqual([bird]);
  });
});

describe("stackCardName", () => {
  it("joins both cards of a double-sided stack", () => {
    expect(stackCardName(pairStack)).toBe("Bird // Gold");
  });
});

describe("stackSideForTile", () => {
  it("returns the side a stacked tile shows", () => {
    expect(stackSideForTile(pairStack, "pair:2")).toBe(gold);
  });

  it("returns side 1 for a copy tile", () => {
    expect(stackSideForTile(pairStack, "c1")).toBe(bird);
  });
});
