import { describe, expect, it } from "vitest";

import { variantRowsFor } from "./marketplace-variant-rows.js";

const sku = { externalId: 42, finish: "normal", language: null };

describe("variantRowsFor", () => {
  it("binds each value to its product by SKU", () => {
    const rows = variantRowsFor(
      "caller",
      [
        { id: "p-normal", marketplace: "cardmarket", ...sku },
        { id: "p-foil", marketplace: "cardmarket", ...sku, finish: "foil" },
      ],
      [
        { marketplace: "cardmarket", ...sku, finish: "foil", printingId: "pr-1" },
        { marketplace: "cardmarket", ...sku, printingId: "pr-2" },
      ],
    );

    expect(rows).toEqual([
      { marketplaceProductId: "p-foil", printingId: "pr-1" },
      { marketplaceProductId: "p-normal", printingId: "pr-2" },
    ]);
  });

  it("keeps two marketplaces sharing an external id apart", () => {
    const rows = variantRowsFor(
      "caller",
      [
        { id: "p-tcg", marketplace: "tcgplayer", ...sku },
        { id: "p-cm", marketplace: "cardmarket", ...sku },
      ],
      [{ marketplace: "cardmarket", ...sku, printingId: "pr-cm" }],
    );

    expect(rows).toEqual([{ marketplaceProductId: "p-cm", printingId: "pr-cm" }]);
  });

  it("names the caller when a product is missing", () => {
    expect(() =>
      variantRowsFor(
        "upsertProductVariants",
        [],
        [{ marketplace: "cardmarket", ...sku, language: "EN", printingId: "pr-1" }],
      ),
    ).toThrow("upsertProductVariants: missing product id for cardmarket 42 normal/EN");
  });
});
