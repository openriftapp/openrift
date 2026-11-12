import { describe, expect, it } from "vitest";

import { listIntentLabel, listIntentNoun, listKindNoun } from "./list-intent";

describe("listKindNoun", () => {
  it("uses the singular noun when the count is exactly one", () => {
    expect(listKindNoun("card", 1)).toBe("card");
    expect(listKindNoun("printing", 1)).toBe("printing");
    expect(listKindNoun("copy", 1)).toBe("copy");
  });

  it("uses the plural noun for zero or many", () => {
    expect(listKindNoun("card", 0)).toBe("cards");
    expect(listKindNoun("printing", 3)).toBe("printings");
    expect(listKindNoun("copy", 2)).toBe("copies");
  });
});

describe("listIntentLabel", () => {
  it("uses the product word for each intent", () => {
    expect(listIntentLabel("wish")).toBe("Wishlist");
    expect(listIntentLabel("trade")).toBe("Tradelist");
    expect(listIntentLabel("organize")).toBe("Organize");
  });
});

describe("listIntentNoun", () => {
  it("names each intent in running text", () => {
    expect(listIntentNoun("wish")).toBe("wishlist");
    expect(listIntentNoun("trade")).toBe("tradelist");
    expect(listIntentNoun("organize")).toBe("list");
  });
});
