import { chunk } from "@openrift/shared/collections";
import type { ProductDetailResponse } from "@openrift/shared/contracts/products";

/** One row of the POST /copies payload. */
export interface ProductCopyRow {
  printingId: string;
  collectionId: string;
}

/** POST /copies accepts at most 500 copies per request. */
export const PRODUCT_COPY_BATCH_SIZE = 500;

/** Clamps non-positive or fractional counts the same way {@link expandProductContents} does. */
export function productCopyTotal(
  contents: ProductDetailResponse["contents"],
  productCount: number,
): number {
  const kits = Math.max(0, Math.floor(productCount));
  return kits * contents.reduce((sum, content) => sum + content.quantity, 0);
}

export function expandProductContents(
  contents: ProductDetailResponse["contents"],
  collectionId: string,
  productCount: number,
): ProductCopyRow[] {
  const kits = Math.max(0, Math.floor(productCount));
  const rows: ProductCopyRow[] = [];
  for (let kit = 0; kit < kits; kit++) {
    for (const content of contents) {
      for (let index = 0; index < content.quantity; index++) {
        rows.push({ printingId: content.printingId, collectionId });
      }
    }
  }
  return rows;
}

export function chunkProductCopies(rows: ProductCopyRow[]): ProductCopyRow[][] {
  return chunk(rows, PRODUCT_COPY_BATCH_SIZE);
}
