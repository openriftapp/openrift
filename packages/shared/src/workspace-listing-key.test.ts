import { describe, expect, it } from "vitest";

import { isListingOwnerId, listingOwnerId, parseListingOwnerId } from "./workspace-listing-key.js";

describe("listingOwnerId", () => {
  it("leaves the language off a language-aggregate SKU", () => {
    expect(
      listingOwnerId({ marketplace: "cardmarket", externalId: 12, finish: "foil", language: null }),
    ).toBe("listing:cardmarket:12:foil");
  });

  it("round-trips a per-language SKU", () => {
    const sku = {
      marketplace: "cardtrader" as const,
      externalId: 417_492,
      finish: "normal",
      language: "ZH",
    };
    expect(parseListingOwnerId(listingOwnerId(sku))).toEqual(sku);
  });
});

describe("parseListingOwnerId", () => {
  it("parses a SKU without a language", () => {
    expect(parseListingOwnerId("listing:tcgplayer:5:normal")).toEqual({
      marketplace: "tcgplayer",
      externalId: 5,
      finish: "normal",
      language: null,
    });
  });

  it.each([
    "cp-123",
    "listing:ebay:5:normal",
    "listing:tcgplayer:abc:normal",
    "listing:tcgplayer:5",
    "listing:tcgplayer:5:normal:",
    "listing:tcgplayer:5:normal:EN:extra",
  ])("rejects %s", (ownerId) => {
    expect(parseListingOwnerId(ownerId)).toBeNull();
  });
});

describe("isListingOwnerId", () => {
  it("tells a listing key from a candidate printing id", () => {
    expect(isListingOwnerId("listing:tcgplayer:5:normal")).toBe(true);
    expect(isListingOwnerId("0199aa00-0000-7000-8000-000000000000")).toBe(false);
  });
});
