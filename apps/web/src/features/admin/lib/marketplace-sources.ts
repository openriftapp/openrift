import { HOUR_MS } from "@openrift/shared/format-date";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { headlinePrice } from "@openrift/shared/price-headline";
import type { Marketplace } from "@openrift/shared/types/pricing";

import type { SourceMappingConfig } from "@/features/admin/lib/price-mappings-types";

const SHORT_NAMES: Record<Marketplace, string> = {
  tcgplayer: "TCG",
  cardmarket: "CM",
  cardtrader: "CT",
  cardnexus: "CN",
};

function sourceConfig(marketplace: Marketplace): SourceMappingConfig {
  return {
    source: marketplace,
    displayName: MARKETPLACE_LINKS[marketplace].label,
    shortName: SHORT_NAMES[marketplace],
    productUrl: MARKETPLACE_LINKS[marketplace].productUrl,
  };
}

export const SOURCE_CONFIGS: Record<Marketplace, SourceMappingConfig> = {
  tcgplayer: sourceConfig("tcgplayer"),
  cardmarket: sourceConfig("cardmarket"),
  cardtrader: sourceConfig("cardtrader"),
  cardnexus: sourceConfig("cardnexus"),
};

const STALE_THRESHOLD_MS = 48 * HOUR_MS;

export function isStaleRecord(recordedAt: Date, now = Date.now()): boolean {
  return now - recordedAt.getTime() > STALE_THRESHOLD_MS;
}

export function listingPriceCents(
  marketplace: Marketplace,
  product: { marketCents: number | null; lowCents: number | null; zeroLowCents: number | null },
): number | null {
  const price = headlinePrice(marketplace, {
    market: product.marketCents,
    low: product.lowCents,
    zeroLow: product.zeroLowCents,
  });
  return price !== null && price > 0 ? price : null;
}
