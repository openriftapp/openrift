import { describe, expect, it } from "vitest";

import { toIgnoredProductResponse } from "./ignored-product-presenters.js";

const createdAt = new Date("2026-09-01T12:00:00.000Z");

describe("toIgnoredProductResponse", () => {
  it("maps a product-level ignore", () => {
    expect(
      toIgnoredProductResponse({
        level: "product",
        marketplace: "tcgplayer",
        externalId: 42,
        productName: "Booster Box",
        createdAt,
      }),
    ).toEqual({
      level: "product",
      marketplace: "tcgplayer",
      externalId: 42,
      productName: "Booster Box",
      createdAt: "2026-09-01T12:00:00.000Z",
    });
  });

  it("maps a variant-level ignore with its finish and language", () => {
    expect(
      toIgnoredProductResponse({
        level: "variant",
        marketplace: "cardmarket",
        externalId: 7,
        finish: "foil",
        language: null,
        productName: "Jinx",
        createdAt,
      }),
    ).toEqual({
      level: "variant",
      marketplace: "cardmarket",
      externalId: 7,
      finish: "foil",
      language: null,
      productName: "Jinx",
      createdAt: "2026-09-01T12:00:00.000Z",
    });
  });
});
