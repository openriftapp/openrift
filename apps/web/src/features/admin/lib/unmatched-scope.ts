import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";

interface UnmatchedRow {
  marketplace: Marketplace;
  product: StagedProductResponse;
}

export function scopeUnmatchedRows(
  unmatchedProducts: Record<Marketplace, StagedProductResponse[]>,
  setSlug?: string,
): { rows: UnmatchedRow[]; unattributedCount: number } {
  const rows: UnmatchedRow[] = [];
  let unattributedCount = 0;
  for (const marketplace of ALL_MARKETPLACES) {
    for (const product of unmatchedProducts[marketplace]) {
      const groupSet = product.groupSetSlug ?? null;
      if (groupSet === null) {
        unattributedCount++;
      }
      if (!setSlug || groupSet === setSlug) {
        rows.push({ marketplace, product });
      }
    }
  }
  return { rows, unattributedCount };
}
