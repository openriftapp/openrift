import { describe, expect, it } from "vitest";

import {
  bracketMatchShortLabel,
  bracketRoundLabel,
  bracketRoundLabels,
  bracketRoundShortLabel,
} from "./bracket-round-label";

describe("bracketRoundLabel", () => {
  it("names the last four rounds counting back from the final", () => {
    expect(bracketRoundLabel(0)).toBe("Final");
    expect(bracketRoundLabel(1)).toBe("Semifinals");
    expect(bracketRoundLabel(2)).toBe("Quarterfinals");
    expect(bracketRoundLabel(3)).toBe("Round of 16");
  });

  it("names a deeper round by the bracket it opens", () => {
    expect(bracketRoundLabel(4)).toBe("Round of 32");
    expect(bracketRoundLabel(5)).toBe("Round of 64");
  });
});

describe("bracketRoundShortLabel", () => {
  it("abbreviates the rounds before the final", () => {
    expect(bracketRoundShortLabel(0)).toBe("Final");
    expect(bracketRoundShortLabel(1)).toBe("SF");
    expect(bracketRoundShortLabel(2)).toBe("QF");
    expect(bracketRoundShortLabel(3)).toBe("R16");
  });

  it("keeps the full label for a deeper round", () => {
    expect(bracketRoundShortLabel(4)).toBe("Round of 32");
  });
});

describe("bracketMatchShortLabel", () => {
  it("numbers a match within its round", () => {
    expect(bracketMatchShortLabel(2, 3)).toBe("QF 3");
    expect(bracketMatchShortLabel(1, 1)).toBe("SF 1");
  });

  it("leaves the final unnumbered", () => {
    expect(bracketMatchShortLabel(0, 1)).toBe("Final");
  });
});

describe("bracketRoundLabels", () => {
  it("orders the rounds from the first to the final", () => {
    expect(bracketRoundLabels(3)).toEqual(["Quarterfinals", "Semifinals", "Final"]);
  });

  it("returns nothing for a bracket without rounds", () => {
    expect(bracketRoundLabels(0)).toEqual([]);
  });
});
