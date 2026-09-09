import { describe, expect, it } from "vitest";

import { summarizeListNames } from "./overlay-list-names";

describe("summarizeListNames", () => {
  it("returns the single name on its own", () => {
    expect(summarizeListNames(["Summoner Skirmish pickups"])).toBe("Summoner Skirmish pickups");
  });

  it("joins two names with and", () => {
    expect(summarizeListNames(["Runeterra staples", "Foils"])).toBe("Runeterra staples and Foils");
  });

  it("names all three", () => {
    expect(summarizeListNames(["Runeterra staples", "Foils", "Piltover build"])).toBe(
      "Runeterra staples, Foils and Piltover build",
    );
  });

  it("names the first three and counts the rest", () => {
    expect(
      summarizeListNames(["Runeterra staples", "Foils", "Piltover build", "Noxus build"]),
    ).toBe("Runeterra staples, Foils, Piltover build and 1 more");
  });

  it("counts more than one leftover", () => {
    expect(summarizeListNames(["A", "B", "C", "D", "E"])).toBe("A, B, C and 2 more");
  });

  it("returns an empty string for no names", () => {
    expect(summarizeListNames([])).toBe("");
  });
});
