import { WellKnown } from "@openrift/shared/well-known";
import { describe, expect, it } from "vitest";

import { legendFromDeckLines } from "./meta-deck-lines.js";

describe("legendFromDeckLines", () => {
  it("reads the legend off the deck's own Legend line", () => {
    const lines = [
      { zone: WellKnown.deckZone.LEGEND, cardName: "Lee Sin, Blind Monk" },
      { zone: WellKnown.deckZone.MAIN, cardName: "Gust" },
    ];
    expect(legendFromDeckLines(lines)).toBe("Lee Sin, Blind Monk");
  });

  it("says nothing for a list with no legend line", () => {
    expect(legendFromDeckLines([{ zone: WellKnown.deckZone.MAIN, cardName: "Gust" }])).toBeNull();
  });
});
