import type {
  CardmarketStockRow,
  CardmarketUnresolvedReason,
} from "@openrift/shared/cardmarket-stock";
import { conditionSlugForCardmarket } from "@openrift/shared/cardmarket-stock";

import type { CardmarketProductPrintingRow } from "../repositories/cardmarket-stock.js";
import { indexProductPrintings, resolveCardmarketProduct } from "./cardmarket-product-resolve.js";

export interface CardmarketResolvedRow {
  row: CardmarketStockRow;
  printingId: string;
  conditionSlug: string;
  language: string;
}

interface CardmarketUnresolvedRow {
  row: CardmarketStockRow;
  reason: CardmarketUnresolvedReason;
}

export interface CardmarketStockResolution {
  resolved: CardmarketResolvedRow[];
  unresolved: CardmarketUnresolvedRow[];
}

export function resolveCardmarketStock(
  rows: readonly CardmarketStockRow[],
  productPrintings: readonly CardmarketProductPrintingRow[],
): CardmarketStockResolution {
  const index = indexProductPrintings(productPrintings);

  const resolved: CardmarketResolvedRow[] = [];
  const unresolved: CardmarketUnresolvedRow[] = [];

  for (const row of rows) {
    const conditionSlug = conditionSlugForCardmarket(row.idCondition);
    if (conditionSlug === undefined) {
      unresolved.push({ row, reason: "unknown-condition" });
      continue;
    }
    const resolution = resolveCardmarketProduct(row, index);
    if ("reason" in resolution) {
      unresolved.push({ row, reason: resolution.reason });
      continue;
    }
    resolved.push({ row, conditionSlug, ...resolution });
  }

  return { resolved, unresolved };
}
