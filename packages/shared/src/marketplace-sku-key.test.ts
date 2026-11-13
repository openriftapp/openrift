import { describe, expect, it } from "vitest";

import { marketplaceSkuKey, skuKey } from "./marketplace-sku-key.js";

describe("skuKey", () => {
  it("joins the product, finish and language", () => {
    expect(skuKey(12, "foil", "FR")).toBe("12::foil::FR");
  });

  it("encodes a missing language as empty", () => {
    expect(skuKey(12, "normal", null)).toBe("12::normal::");
  });
});

describe("marketplaceSkuKey", () => {
  it("prefixes the marketplace", () => {
    expect(marketplaceSkuKey("cardmarket", 12, "normal", null)).toBe("cardmarket::12::normal::");
  });
});
