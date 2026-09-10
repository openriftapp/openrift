import type { CardmarketUnresolvedReason } from "@openrift/shared/cardmarket-stock";
import { printingLanguageForCardmarket } from "@openrift/shared/cardmarket-stock";
import { WellKnown } from "@openrift/shared/well-known";

import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";

export interface CardmarketProductQuery {
  idProduct: number;
  isFoil: boolean;
  idLanguage: number;
}

export type CardmarketProductResolution =
  | { printingId: string; language: string }
  | { reason: CardmarketUnresolvedReason };

export type CardmarketProductIndex = Map<string, CardmarketProductPrintingRow[]>;

function productKey(externalId: number, finish: string): string {
  return `${externalId}::${finish}`;
}

export function indexProductPrintings(
  productPrintings: readonly CardmarketProductPrintingRow[],
): CardmarketProductIndex {
  return Map.groupBy(productPrintings, (p) => productKey(p.externalId, p.finish));
}

// Cardmarket products are language-aggregate, so the article's own
// `idLanguage` picks among the printings behind one product.
export function resolveCardmarketProduct(
  query: CardmarketProductQuery,
  index: CardmarketProductIndex,
): CardmarketProductResolution {
  const language = printingLanguageForCardmarket(query.idLanguage);
  if (language === undefined) {
    return { reason: "language-not-printed" };
  }

  const finish = query.isFoil ? WellKnown.finish.FOIL : WellKnown.finish.NORMAL;
  const candidates = index.get(productKey(query.idProduct, finish));
  if (candidates === undefined) {
    return { reason: "unknown-product" };
  }

  const mapped = candidates.flatMap((c) =>
    c.printingId === null ? [] : [{ printingId: c.printingId, language: c.language }],
  );
  if (mapped.length === 0) {
    return { reason: "unmapped-product" };
  }

  const printingIds = new Set(
    mapped.filter((c) => c.language === language).map((c) => c.printingId),
  );
  const [printingId] = printingIds;
  if (printingId === undefined) {
    return { reason: "no-printing-in-language" };
  }
  if (printingIds.size > 1) {
    return { reason: "ambiguous-printing" };
  }
  return { printingId, language };
}
