import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import {
  ALL_MARKETPLACES,
  LANGUAGE_KEYED_MARKETPLACES,
  marketplaceCarriesLanguage,
} from "@openrift/shared/types/pricing";

import type { CardListingRow } from "@/features/catalog-workspace/lib/card-listing-rows";

type Mapping = AdminCardDetailResponse["marketplaceMappings"][number];

export interface MarketplaceCoverage {
  marketplace: Marketplace;
  carriesLanguage: boolean;
  products: Mapping[];
}

export function mappingKey(mapping: Mapping): string {
  return marketplaceSkuKey(
    mapping.marketplace,
    mapping.externalId,
    mapping.finish,
    mapping.variantLanguage,
  );
}

export function marketplaceCoverage(
  mappings: readonly Mapping[],
  printingId: string,
  language: string,
): MarketplaceCoverage[] {
  const own = new Map(
    mappings
      .filter((mapping) => mapping.targetPrintingId === printingId)
      .map((mapping) => [mappingKey(mapping), mapping]),
  );
  const byMarketplace = Map.groupBy(own.values(), (mapping) => mapping.marketplace);
  return ALL_MARKETPLACES.map((marketplace) => ({
    marketplace,
    carriesLanguage: marketplaceCarriesLanguage(marketplace, language),
    products: byMarketplace.get(marketplace) ?? [],
  }));
}

export function pickableListings(
  unassigned: readonly CardListingRow[],
  marketplace: Marketplace,
  printingId: string,
): CardListingRow[] {
  const suggested = (row: CardListingRow) => row.suggestion?.printing.printingId === printingId;
  return unassigned
    .filter((row) => {
      const printing = row.assignablePrintings.find((entry) => entry.printingId === printingId);
      if (row.marketplace !== marketplace || printing === undefined) {
        return false;
      }
      const { language } = row.product;
      return (
        !LANGUAGE_KEYED_MARKETPLACES.has(marketplace) ||
        language === null ||
        language === printing.language
      );
    })
    .toSorted((a, b) => Number(suggested(b)) - Number(suggested(a)));
}
