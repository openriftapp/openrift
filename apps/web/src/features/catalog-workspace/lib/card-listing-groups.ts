import type { WorkspaceListingVariant } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import { productSuggestionKey } from "@openrift/shared/marketplace-suggestions";
import type { UnifiedMappingGroupResponse } from "@openrift/shared/types/api/admin";

import type { CardListingRow } from "./card-listing-rows";
import { buildCardListings } from "./card-listing-rows";

export interface ListingVariantGroup {
  key: string;
  language: string | null;
  finish: string;
  rows: CardListingRow[];
}

function variantKey(variant: { language: string | null; finish: string }): string {
  return `${variant.language ?? ""}|${variant.finish}`;
}

export function unmatchedListingGroups(
  group: UnifiedMappingGroupResponse,
  suggestions: ReadonlyMap<string, ProductSuggestion[]>,
  variants: readonly WorkspaceListingVariant[],
): ListingVariantGroup[] {
  const printingIds = new Set(group.printings.map((printing) => printing.printingId));
  const unmatched = buildCardListings(group, suggestions).unassigned.filter(
    (row) =>
      !(
        suggestions.get(
          productSuggestionKey(
            row.marketplace,
            row.product.externalId,
            row.product.finish,
            row.product.language,
          ),
        ) ?? []
      ).some((suggestion) => suggestion.isWeak !== true && printingIds.has(suggestion.printingId)),
  );
  const rowsByVariant = Map.groupBy(unmatched, (row) => variantKey(row.product));
  return variants.flatMap((variant) => {
    const key = variantKey(variant);
    const rows = rowsByVariant.get(key) ?? [];
    return rows.length === 0
      ? []
      : [{ key, language: variant.language, finish: variant.finish, rows }];
  });
}
