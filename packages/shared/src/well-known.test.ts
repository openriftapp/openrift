import { describe, expect, it } from "vitest";

import { isBaseBanFormat, isFoilFinish, marketplaceFinish, WellKnown } from "./well-known.js";

describe("isBaseBanFormat", () => {
  it("treats the base constructed list as the base ban format", () => {
    expect(isBaseBanFormat(WellKnown.banFormat.CONSTRUCTED)).toBe(true);
    expect(isBaseBanFormat("standard")).toBe(true);
  });

  it("treats mode-scoped formats as non-base", () => {
    expect(isBaseBanFormat("2v2")).toBe(false);
    expect(isBaseBanFormat("1v1")).toBe(false);
    expect(isBaseBanFormat("ffa")).toBe(false);
    expect(isBaseBanFormat("freeform")).toBe(false);
  });

  it("does not match on empty or near-miss ids", () => {
    expect(isBaseBanFormat("")).toBe(false);
    expect(isBaseBanFormat("Standard")).toBe(false);
    expect(isBaseBanFormat(" standard")).toBe(false);
  });
});

describe("isFoilFinish", () => {
  it("counts plain and shatter foil as foil", () => {
    expect(isFoilFinish(WellKnown.finish.FOIL)).toBe(true);
    expect(isFoilFinish(WellKnown.finish.SHATTER_FOIL)).toBe(true);
  });

  it("does not count normal or metal finishes", () => {
    expect(isFoilFinish(WellKnown.finish.NORMAL)).toBe(false);
    expect(isFoilFinish(WellKnown.finish.METAL)).toBe(false);
    expect(isFoilFinish(WellKnown.finish.METAL_DELUXE)).toBe(false);
  });
});

describe("marketplaceFinish", () => {
  it("joins shatter foil and metal finishes to the marketplace foil SKU", () => {
    expect(marketplaceFinish(WellKnown.finish.SHATTER_FOIL)).toBe(WellKnown.finish.FOIL);
    expect(marketplaceFinish(WellKnown.finish.METAL)).toBe(WellKnown.finish.FOIL);
    expect(marketplaceFinish(WellKnown.finish.METAL_DELUXE)).toBe(WellKnown.finish.FOIL);
  });

  it("passes normal and foil through", () => {
    expect(marketplaceFinish(WellKnown.finish.NORMAL)).toBe(WellKnown.finish.NORMAL);
    expect(marketplaceFinish(WellKnown.finish.FOIL)).toBe(WellKnown.finish.FOIL);
  });
});
