import { describe, expect, it } from "vitest";

import { formatCardListAsDeckText, formatCardmarketWants } from "./export-text";

describe("formatCardListAsDeckText", () => {
  it("formats lines as `<qty> <name>`, preserving input order", () => {
    const output = formatCardListAsDeckText([
      { name: "Teemo, Scout", quantity: 1 },
      { name: "Jinx, Rebel", quantity: 3 },
    ]);
    expect(output).toBe("1 Teemo, Scout\n3 Jinx, Rebel");
  });

  it("returns an empty string when there are no lines", () => {
    expect(formatCardListAsDeckText([])).toBe("");
  });

  it("straightens curly apostrophes so the text round-trips through other tools", () => {
    const output = formatCardListAsDeckText([{ name: "Kai’Sa, Survivor", quantity: 2 }]);
    expect(output).toBe("2 Kai'Sa, Survivor");
  });

  it("merges repeated names into their first position", () => {
    const output = formatCardListAsDeckText([
      { name: "Cleave", quantity: 2 },
      { name: "Jinx, Rebel", quantity: 1 },
      { name: "Cleave", quantity: 1 },
    ]);
    expect(output).toBe("3 Cleave\n1 Jinx, Rebel");
  });
});

describe("formatCardmarketWants", () => {
  it("formats wants as `<qty>x <name>` lines, sorted by name", () => {
    const output = formatCardmarketWants([
      { name: "Viktor, Herald of the Arcane", quantity: 1 },
      { name: "Cleave", quantity: 2 },
    ]);
    expect(output).toBe("2x Cleave\n1x Viktor, Herald of the Arcane");
  });

  it("merges wants of the same card, summing quantities", () => {
    const output = formatCardmarketWants([
      { name: "Cleave", quantity: 2 },
      { name: "Jinx, Rebel", quantity: 1 },
      { name: "Cleave", quantity: 1 },
    ]);
    expect(output).toBe("3x Cleave\n1x Jinx, Rebel");
  });

  it("straightens curly apostrophes so Cardmarket matches the name", () => {
    expect(formatCardmarketWants([{ name: "Kai’Sa, Survivor", quantity: 1 }])).toBe(
      "1x Kai'Sa, Survivor",
    );
  });

  it("merges names that only differ in apostrophe style", () => {
    const output = formatCardmarketWants([
      { name: "Kai’Sa, Survivor", quantity: 1 },
      { name: "Kai'Sa, Survivor", quantity: 2 },
    ]);
    expect(output).toBe("3x Kai'Sa, Survivor");
  });

  it("returns an empty string when there are no wants", () => {
    expect(formatCardmarketWants([])).toBe("");
  });
});
