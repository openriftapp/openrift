import type { UnifiedMappingGroupResponse } from "./types/api/admin.js";
import type { Marketplace } from "./types/pricing.js";
import { WellKnown } from "./well-known.js";

export interface PriceAssignBucket {
  marketplace: Marketplace;
  /** Null for Cardmarket/TCGplayer (assumed EN); a language code for CardTrader. */
  language: string | null;
  unbound: number;
  /** Whether a matching-language printing exists on this card. */
  assignable: boolean;
}

function targetLanguage(language: string | null): string {
  return language ?? WellKnown.language.EN;
}

export function computePriceAssignBuckets(
  group: Pick<UnifiedMappingGroupResponse, "printings" | Marketplace>,
): PriceAssignBucket[] {
  const printingLanguages = new Set(group.printings.map((printing) => printing.language));
  const marketplaces: Marketplace[] = ["tcgplayer", "cardmarket", "cardtrader"];
  const buckets: PriceAssignBucket[] = [];

  for (const marketplace of marketplaces) {
    const staged = group[marketplace].stagedProducts;
    if (staged.length === 0) {
      continue;
    }
    const countByLanguage = new Map<string | null, number>();
    for (const product of staged) {
      const language = marketplace === "cardtrader" ? product.language : null;
      countByLanguage.set(language, (countByLanguage.get(language) ?? 0) + 1);
    }
    for (const [language, unbound] of countByLanguage) {
      buckets.push({
        marketplace,
        language,
        unbound,
        assignable: printingLanguages.has(targetLanguage(language)),
      });
    }
  }

  return buckets;
}

/** Cards without staged products are left out. */
export function buildPriceAssignBucketsBySlug(
  groups: UnifiedMappingGroupResponse[],
): Record<string, PriceAssignBucket[]> {
  const result: Record<string, PriceAssignBucket[]> = {};
  for (const group of groups) {
    const buckets = computePriceAssignBuckets(group);
    if (buckets.length > 0) {
      result[group.cardSlug] = buckets;
    }
  }
  return result;
}
