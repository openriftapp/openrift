import { cardmarketLanguageName } from "@openrift/shared/cardmarket-stock";
import type { CardmarketPicksResolution } from "@openrift/shared/contracts/cardmarket-picks";

import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";
import type {
  CardmarketProductQuery,
  CardmarketProductResolution,
} from "./cardmarket-product-resolve.js";

export function presentCardmarketPicksResolution(
  rows: readonly { query: CardmarketProductQuery; resolution: CardmarketProductResolution }[],
  productPrintings: readonly CardmarketProductPrintingRow[],
): CardmarketPicksResolution {
  const productNames = new Map(productPrintings.map((p) => [p.externalId, p.productName]));

  return {
    rows: rows.map(({ query, resolution }) => ({
      idProduct: query.idProduct,
      isFoil: query.isFoil,
      idLanguage: query.idLanguage,
      printingId: "printingId" in resolution ? resolution.printingId : null,
      reason: "reason" in resolution ? resolution.reason : null,
      productName: productNames.get(query.idProduct) ?? null,
      languageName: cardmarketLanguageName(query.idLanguage) ?? null,
    })),
  };
}
