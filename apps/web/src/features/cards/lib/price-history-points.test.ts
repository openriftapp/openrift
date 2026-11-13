import { describe, expect, it } from "vitest";

import { priceHistoryPoint } from "./price-history-points";

describe("priceHistoryPoint", () => {
  it("plots the market price with the low alongside where market is the headline", () => {
    expect(priceHistoryPoint("tcgplayer", { date: "2026-10-01", market: 452, low: 325 })).toEqual({
      date: "2026-10-01",
      value: 452,
      secondary: 325,
    });
  });

  it("plots the low price, the figure players see, with the market alongside on Cardmarket", () => {
    expect(priceHistoryPoint("cardmarket", { date: "2026-10-01", market: 452, low: 325 })).toEqual({
      date: "2026-10-01",
      value: 325,
      secondary: 452,
    });
    expect(
      priceHistoryPoint("cardmarket", { date: "2026-10-01", market: 452, low: null }).value,
    ).toBe(452);
  });

  it("plots the hub-seller price on the per-seller marketplace", () => {
    expect(priceHistoryPoint("cardtrader", { date: "2026-10-01", zeroLow: 420, low: 390 })).toEqual(
      { date: "2026-10-01", value: 420, secondary: 390 },
    );
  });

  it("keeps a missing hub-seller price empty", () => {
    expect(
      priceHistoryPoint("cardtrader", { date: "2026-10-01", zeroLow: null, low: 390 }).value,
    ).toBeNull();
  });

  it("plots the lowest listing without a second line where only low is known", () => {
    expect(priceHistoryPoint("cardnexus", { date: "2026-10-01", low: 370 })).toEqual({
      date: "2026-10-01",
      value: 370,
      secondary: null,
    });
  });
});
