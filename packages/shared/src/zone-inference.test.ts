import { describe, expect, it } from "vitest";

import { inferZone, sourceSlotForZone } from "./zone-inference.js";

describe("inferZone", () => {
  it.each([
    [
      "chosenChampion to champion for a champion unit",
      ["unit"],
      ["champion"],
      "chosenChampion",
      "champion",
    ],
    ["chosenChampion to champion for a plain unit", ["unit"], [], "chosenChampion", "champion"],
    ["sideboard to sideboard for a unit", ["unit"], [], "sideboard", "sideboard"],
    ["sideboard to sideboard for a spell", ["spell"], [], "sideboard", "sideboard"],
    ["sideboard to sideboard for a rune", ["rune"], [], "sideboard", "sideboard"],
    [
      "legendOptions to legend options for a legend",
      ["legend"],
      [],
      "legendOptions",
      "legend-options",
    ],
    ["a mainDeck Legend to legend", ["legend"], [], "mainDeck", "legend"],
    ["a mainDeck Rune to runes", ["rune"], [], "mainDeck", "runes"],
    ["a mainDeck Battlefield to battlefield", ["battlefield"], [], "mainDeck", "battlefield"],
    ["a mainDeck Unit to main", ["unit"], [], "mainDeck", "main"],
    [
      "a mainDeck Unit Battlefield to battlefield",
      ["unit", "battlefield"],
      [],
      "mainDeck",
      "battlefield",
    ],
    ["a mainDeck Unit Rune to runes", ["unit", "rune"], [], "mainDeck", "runes"],
    [
      "a mainDeck Champion supertype to main for extra copies",
      ["unit"],
      ["champion"],
      "mainDeck",
      "main",
    ],
  ] as const)("maps %s", (_title, cardTypes, superTypes, sourceSlot, expected) => {
    expect(inferZone(cardTypes, [...superTypes], sourceSlot)).toBe(expected);
  });
});

describe("sourceSlotForZone", () => {
  it("maps the two zones that have their own slot", () => {
    expect(sourceSlotForZone("champion")).toBe("chosenChampion");
    expect(sourceSlotForZone("sideboard")).toBe("sideboard");
  });

  it("maps every other zone to the main deck", () => {
    for (const zone of ["main", "legend", "runes", "battlefield", "overflow"] as const) {
      expect(sourceSlotForZone(zone)).toBe("mainDeck");
    }
  });

  it("round-trips through inferZone for the slot-carrying zones", () => {
    expect(inferZone(["unit"], [], sourceSlotForZone("champion"))).toBe("champion");
    expect(inferZone(["unit"], [], sourceSlotForZone("sideboard"))).toBe("sideboard");
  });
});
