import { describe, expect, it } from "vitest";

import { priceHistoryPoint } from "./price-history-points";

describe("priceHistoryPoint", () => {
  it("plots the market price with the low alongside for TCGplayer and Cardmarket", () => {
    expect(priceHistoryPoint({ date: "2026-10-01", market: 452, low: 325 })).toEqual({
      date: "2026-10-01",
      value: 452,
      low: 325,
    });
  });

  it("plots the Zero price for CardTrader", () => {
    expect(priceHistoryPoint({ date: "2026-10-01", zeroLow: 420, low: 390 })).toEqual({
      date: "2026-10-01",
      value: 420,
      low: 390,
    });
  });

  it("keeps a missing CardTrader Zero price empty", () => {
    expect(priceHistoryPoint({ date: "2026-10-01", zeroLow: null, low: 390 }).value).toBeNull();
  });

  it("plots the lowest listing for CardNexus without a second low line", () => {
    expect(priceHistoryPoint({ date: "2026-10-01", low: 370 })).toEqual({
      date: "2026-10-01",
      value: 370,
      low: null,
    });
  });
});
