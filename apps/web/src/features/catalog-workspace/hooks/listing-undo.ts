import { marketplaceLabel } from "@openrift/shared/marketplace";
import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";

import { unmapMarketplacePrintingFn } from "@/features/admin/hooks/use-admin-card-mutations";
import { unignoreProductFn } from "@/features/admin/hooks/use-ignored-products";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import {
  ignoredUndoText,
  mappedUndoText,
  undoScope,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { withWriteSignal } from "@/lib/write-signal";

export interface ListingSkuValues {
  externalId: number;
  finish: string;
  language: string | null;
}

function listingScope() {
  return undoScope([adminKeys.unifiedMappings.all, adminKeys.ignoredProducts, adminKeys.cards.all]);
}

export function listingName(marketplace: AdminMarketplaceName, skus: readonly ListingSkuValues[]) {
  const ids = [...new Set(skus.map((sku) => `#${sku.externalId}`))];
  return `${marketplaceLabel(marketplace)} ${ids.join(", ")}`;
}

export function ignoredVariantsUndo(
  marketplace: AdminMarketplaceName,
  skus: readonly ListingSkuValues[],
  record: string,
): WorkspaceUndoEntry {
  return {
    ...ignoredUndoText({
      what: listingName(marketplace, skus),
      record,
      plural: new Set(skus.map((sku) => sku.externalId)).size > 1,
    }),
    invalidates: listingScope(),
    undo: async (signal) => {
      await Promise.all(
        skus.map((sku) =>
          withWriteSignal(signal, () =>
            unignoreProductFn({ data: { level: "variant", marketplace, ...sku }, signal }),
          ),
        ),
      );
    },
  };
}

export function ignoredProductUndo(
  marketplace: AdminMarketplaceName,
  externalId: number,
  record: string,
): WorkspaceUndoEntry {
  return {
    ...ignoredUndoText({
      what: `every SKU of ${marketplaceLabel(marketplace)} #${externalId}`,
      record,
    }),
    invalidates: listingScope(),
    undo: async (signal) => {
      await withWriteSignal(signal, () =>
        unignoreProductFn({ data: { level: "product", marketplace, externalId }, signal }),
      );
    },
  };
}

export function assignedListingUndo(
  marketplace: AdminMarketplaceName,
  sku: ListingSkuValues,
  printingId: string,
  record: string,
): WorkspaceUndoEntry {
  return {
    ...mappedUndoText({ listing: listingName(marketplace, [sku]), record }),
    invalidates: listingScope(),
    undo: async (signal) => {
      await withWriteSignal(signal, () =>
        unmapMarketplacePrintingFn({ data: { marketplace, printingId, ...sku }, signal }),
      );
    },
  };
}
