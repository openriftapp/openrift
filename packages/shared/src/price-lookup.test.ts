import { describe, expect, it } from "vitest";

import { priceLookupFromMap } from "./price-lookup.js";
import type { PriceMap } from "./types/api/pricing.js";

describe("priceLookupFromMap", () => {
  const map: PriceMap = {
    "p-1": { tcgplayer: 450, cardmarket: 380 },
    "p-2": { cardmarket: 120 },
  };
  const lookup = priceLookupFromMap(map);

  it.each([
    ["p-1", "tcgplayer", 4.5],
    ["p-1", "cardmarket", 3.8],
    ["p-2", "cardmarket", 1.2],
    ["p-2", "tcgplayer", undefined],
    ["p-1", "cardtrader", undefined],
    ["missing", "tcgplayer", undefined],
  ] as const)(
    "returns the major-unit price for %s on %s, undefined when either is missing",
    (printingId, marketplace, expected) => {
      expect(lookup.get(printingId, marketplace)).toBe(expected);
    },
  );

  it("has() reflects whether the printing has any price entries", () => {
    expect(lookup.has("p-1")).toBe(true);
    expect(lookup.has("p-2")).toBe(true);
    expect(lookup.has("missing")).toBe(false);
  });
});
