import { describe, expect, it } from "vitest";

import { headlineColumn, headlinePrice } from "./price-headline.js";

describe("headlinePrice", () => {
  it("prefers the hub-seller low, then the overall low, on the per-seller marketplace", () => {
    expect(headlinePrice("cardtrader", { zeroLow: 120, low: 90 })).toBe(120);
    expect(headlinePrice("cardtrader", { zeroLow: null, low: 90 })).toBe(90);
  });

  it("prefers low, then market, on the trend-guide marketplace", () => {
    expect(headlinePrice("cardmarket", { market: 400, low: 150 })).toBe(150);
    expect(headlinePrice("cardmarket", { market: 400, low: null })).toBe(400);
  });

  it("prefers market, then low, everywhere else", () => {
    expect(headlinePrice("tcgplayer", { market: 450, low: 300 })).toBe(450);
    expect(headlinePrice("tcgplayer", { market: null, low: 300 })).toBe(300);
    expect(headlinePrice("cardnexus", { low: 210 })).toBe(210);
  });

  it("is null when no headline column is set", () => {
    expect(headlinePrice("cardmarket", {})).toBeNull();
    expect(headlinePrice("cardtrader", { market: 100 })).toBeNull();
  });
});

describe("headlineColumn", () => {
  it("stores a lone headline in the column the regular refresh writes it to", () => {
    expect(headlineColumn("tcgplayer")).toBe("market");
    expect(headlineColumn("cardmarket")).toBe("low");
    expect(headlineColumn("cardtrader")).toBe("zeroLow");
    expect(headlineColumn("cardnexus")).toBe("low");
  });
});
