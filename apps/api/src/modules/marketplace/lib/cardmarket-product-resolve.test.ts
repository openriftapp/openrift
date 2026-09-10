import { describe, expect, it } from "vitest";

import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";
import { indexProductPrintings, resolveCardmarketProduct } from "./cardmarket-product-resolve.js";

function productPrinting(
  overrides: Partial<CardmarketProductPrintingRow> = {},
): CardmarketProductPrintingRow {
  return {
    externalId: 904_070,
    finish: "normal",
    productName: "Ambessa, The Wolf",
    printingId: "printing-en",
    language: "EN",
    ...overrides,
  };
}

describe("resolveCardmarketProduct", () => {
  it("picks the printing in the article's language", () => {
    const index = indexProductPrintings([
      productPrinting({ printingId: "printing-en", language: "EN" }),
      productPrinting({ printingId: "printing-fr", language: "FR" }),
    ]);

    expect(
      resolveCardmarketProduct({ idProduct: 904_070, isFoil: false, idLanguage: 2 }, index),
    ).toEqual({ printingId: "printing-fr", language: "FR" });
  });

  it("keeps foil and normal on their own products", () => {
    const index = indexProductPrintings([
      productPrinting({ finish: "normal", printingId: "printing-normal" }),
      productPrinting({ finish: "foil", printingId: "printing-foil" }),
    ]);

    expect(
      resolveCardmarketProduct({ idProduct: 904_070, isFoil: true, idLanguage: 1 }, index),
    ).toEqual({ printingId: "printing-foil", language: "EN" });
  });

  it("names each way a product fails to resolve", () => {
    const index = indexProductPrintings([
      productPrinting({ externalId: 1, printingId: null, language: null }),
      productPrinting({ externalId: 2, printingId: "printing-en", language: "EN" }),
      productPrinting({ externalId: 3, printingId: "printing-a", language: "EN" }),
      productPrinting({ externalId: 3, printingId: "printing-b", language: "EN" }),
    ]);

    expect(resolveCardmarketProduct({ idProduct: 2, isFoil: false, idLanguage: 3 }, index)).toEqual(
      { reason: "language-not-printed" },
    );
    expect(resolveCardmarketProduct({ idProduct: 2, isFoil: false, idLanguage: 0 }, index)).toEqual(
      { reason: "language-not-printed" },
    );
    expect(resolveCardmarketProduct({ idProduct: 9, isFoil: false, idLanguage: 1 }, index)).toEqual(
      { reason: "unknown-product" },
    );
    expect(resolveCardmarketProduct({ idProduct: 1, isFoil: false, idLanguage: 1 }, index)).toEqual(
      { reason: "unmapped-product" },
    );
    expect(resolveCardmarketProduct({ idProduct: 2, isFoil: false, idLanguage: 2 }, index)).toEqual(
      { reason: "no-printing-in-language" },
    );
    expect(resolveCardmarketProduct({ idProduct: 3, isFoil: false, idLanguage: 1 }, index)).toEqual(
      { reason: "ambiguous-printing" },
    );
  });
});
