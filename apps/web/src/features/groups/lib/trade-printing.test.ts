import { describe, expect, it } from "vitest";

import { stubPrinting } from "@/test/factories";

import { matchOnPrinting, tradePrinting, tradeSideKey } from "./trade-printing";

describe("tradePrinting", () => {
  const bird = stubPrinting({ printingId: "pair", side: 1, cardId: "bird" });
  const gold = stubPrinting({ printingId: "pair", side: 2, cardId: "gold" });
  const byCard = new Map([
    ["bird", [bird]],
    ["gold", [gold]],
  ]);

  it("picks the side that shows the traded card", () => {
    expect(tradePrinting({ cardId: "gold", printingId: "pair" }, byCard, { pair: bird })).toBe(
      gold,
    );
  });

  it("falls back to the printing's first side", () => {
    expect(tradePrinting({ cardId: "other", printingId: "pair" }, byCard, { pair: bird })).toBe(
      bird,
    );
  });

  it("names the side key of the traded card's side", () => {
    expect(tradeSideKey({ cardId: "gold", printingId: "pair" }, byCard, { pair: bird })).toBe(
      "pair:2",
    );
  });
});

describe("matchOnPrinting", () => {
  const row = (cardId: string, counterpartyUserId = "u-1") => ({
    printingId: "pair",
    cardId,
    counterpartyUserId,
  });

  it("prefers the match for the tile's card", () => {
    expect(
      matchOnPrinting([row("bird"), row("gold")], { printingId: "pair", cardId: "gold" }, "u-1"),
    ).toEqual(row("gold"));
  });

  it("takes a printing wish's match from either side", () => {
    expect(matchOnPrinting([row("bird")], { printingId: "pair", cardId: "gold" }, "u-1")).toEqual(
      row("bird"),
    );
  });

  it("ignores other members", () => {
    expect(
      matchOnPrinting([row("gold", "u-2")], { printingId: "pair", cardId: "gold" }, "u-1"),
    ).toBeUndefined();
  });
});
