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

export interface ListingSkuValues {
  externalId: number;
  finish: string;
  language: string | null;
}

function listingScope(marketplace: AdminMarketplaceName) {
  return undoScope([
    adminKeys.unifiedMappings.all,
    adminKeys.marketplace(marketplace),
    adminKeys.ignoredProducts,
    adminKeys.cards.all,
  ]);
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
    invalidates: listingScope(marketplace),
    undo: async () => {
      await Promise.all(
        skus.map((sku) => unignoreProductFn({ data: { level: "variant", marketplace, ...sku } })),
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
    invalidates: listingScope(marketplace),
    undo: async () => {
      await unignoreProductFn({ data: { level: "product", marketplace, externalId } });
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
    invalidates: listingScope(marketplace),
    undo: async () => {
      await unmapMarketplacePrintingFn({ data: { marketplace, printingId, ...sku } });
    },
  };
}
