import type { EffectiveTradePreference } from "@openrift/shared/types/api/trade-preferences";
import { describe, expect, it } from "vitest";

import { fixedPriceVsEstimate } from "./price-vs-estimate";

function fixed(
  cents: number | null,
  currency: "EUR" | "USD" | null = "EUR",
): EffectiveTradePreference {
  return { pricePref: "absolute", priceAbsoluteCents: cents, tradeType: null, currency };
}

describe("fixedPriceVsEstimate", () => {
  it("reports a fixed price below the estimate as favorable when buying", () => {
    expect(fixedPriceVsEstimate(fixed(900), 9.8, "incoming")).toEqual({
      kind: "below",
      difference: expect.closeTo(0.8),
      favorable: true,
    });
  });

  it("reports a fixed price above the estimate as unfavorable when buying", () => {
    expect(fixedPriceVsEstimate(fixed(1400), 5.5, "incoming")).toMatchObject({
      kind: "above",
      favorable: false,
    });
  });

  it("flips favorability when the counterparty is paying", () => {
    expect(fixedPriceVsEstimate(fixed(2000), 15.5, "outgoing")).toMatchObject({
      kind: "above",
      favorable: true,
    });
    expect(fixedPriceVsEstimate(fixed(1000), 15.5, "outgoing")).toMatchObject({
      kind: "below",
      favorable: false,
    });
  });

  it("reads a price within five percent of the estimate as matching", () => {
    expect(fixedPriceVsEstimate(fixed(700), 7.1, "incoming")).toEqual({
      kind: "match",
      difference: 0,
      favorable: true,
    });
  });

  it("returns null for marketplace-relative terms", () => {
    const pref: EffectiveTradePreference = {
      pricePref: "cm_lowest",
      priceAbsoluteCents: null,
      tradeType: null,
      currency: "EUR",
    };
    expect(fixedPriceVsEstimate(pref, 5, "incoming")).toBeNull();
  });

  it("returns null without a price, an estimate, or in a non-euro currency", () => {
    expect(fixedPriceVsEstimate(fixed(null), 5, "incoming")).toBeNull();
    expect(fixedPriceVsEstimate(fixed(500), undefined, "incoming")).toBeNull();
    expect(fixedPriceVsEstimate(fixed(500), 0, "incoming")).toBeNull();
    expect(fixedPriceVsEstimate(fixed(500, "USD"), 5, "incoming")).toBeNull();
    expect(fixedPriceVsEstimate(fixed(500, null), 5, "incoming")).toBeNull();
  });
});
