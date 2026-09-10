import { describe, expect, it } from "vitest";

import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";
import { presentCardmarketPicksResolution } from "./cardmarket-picks-presenters.js";

const productPrintings: CardmarketProductPrintingRow[] = [
  {
    externalId: 904_070,
    finish: "normal",
    productName: "Ambessa, The Wolf",
    printingId: "0199a0f2-0000-7000-8000-000000000001",
    language: "EN",
  },
];

describe("presentCardmarketPicksResolution", () => {
  it("keeps input order and fills the product name for resolved and unresolved rows alike", () => {
    const response = presentCardmarketPicksResolution(
      [
        {
          query: { idProduct: 904_070, isFoil: false, idLanguage: 3 },
          resolution: { reason: "language-not-printed" },
        },
        {
          query: { idProduct: 904_070, isFoil: false, idLanguage: 1 },
          resolution: { printingId: "0199a0f2-0000-7000-8000-000000000001", language: "EN" },
        },
        {
          query: { idProduct: 1, isFoil: true, idLanguage: 0 },
          resolution: { reason: "unknown-product" },
        },
      ],
      productPrintings,
    );

    expect(response.rows).toEqual([
      {
        idProduct: 904_070,
        isFoil: false,
        idLanguage: 3,
        printingId: null,
        reason: "language-not-printed",
        productName: "Ambessa, The Wolf",
        languageName: "German",
      },
      {
        idProduct: 904_070,
        isFoil: false,
        idLanguage: 1,
        printingId: "0199a0f2-0000-7000-8000-000000000001",
        reason: null,
        productName: "Ambessa, The Wolf",
        languageName: "English",
      },
      {
        idProduct: 1,
        isFoil: true,
        idLanguage: 0,
        printingId: null,
        reason: "unknown-product",
        productName: null,
        languageName: null,
      },
    ]);
  });
});
