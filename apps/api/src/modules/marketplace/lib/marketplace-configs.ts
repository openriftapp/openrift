import type { Marketplace } from "@openrift/shared/types/pricing";
import { MARKETPLACE_CURRENCY } from "@openrift/shared/types/pricing";

import type { Repos } from "../../../deps.js";
import type { marketplaceMappingRepo } from "../repositories/marketplace-mapping.js";

export interface PriceColumns {
  marketCents: number | null;
  lowCents: number | null;
  zeroLowCents: number | null;
  midCents: number | null;
  highCents: number | null;
  trendCents: number | null;
  avg1Cents: number | null;
  avg7Cents: number | null;
  avg30Cents: number | null;
}

export interface ProductInfo extends PriceColumns {
  productName: string | null;
  currency: string;
  recordedAt: string;
}

export interface StagingRow extends PriceColumns {
  externalId: number;
  groupId: number;
  productName: string;
  finish: string;
  /** NULL for CM/TCG (see MarketplaceProductsTable in db/tables.ts). */
  language: string | null;
  recordedAt: Date;
}

interface MappedPriceRow extends PriceColumns {
  printingId: string;
  externalId: number;
  productName: string;
  finish: string;
  language: string | null;
  recordedAt: Date;
}

export interface MarketplaceConfig {
  marketplace: Marketplace;
  currency: string;
  mapStagingPrices: (row: StagingRow) => Omit<ProductInfo, "productName" | "recordedAt">;
  priceQuery: (printingIds: string[]) => Promise<MappedPriceRow[]>;
  mapPriceRow: (row: MappedPriceRow) => ProductInfo;
}

function createMarketplaceConfig(
  marketplace: Marketplace,
  repo: ReturnType<typeof marketplaceMappingRepo>,
): MarketplaceConfig {
  const currency = MARKETPLACE_CURRENCY[marketplace];
  const mapPrices = (row: PriceColumns): Omit<ProductInfo, "productName" | "recordedAt"> => ({
    marketCents: row.marketCents,
    lowCents: row.lowCents,
    zeroLowCents: row.zeroLowCents,
    currency,
    midCents: row.midCents,
    highCents: row.highCents,
    trendCents: row.trendCents,
    avg1Cents: row.avg1Cents,
    avg7Cents: row.avg7Cents,
    avg30Cents: row.avg30Cents,
  });

  return {
    marketplace,
    currency,
    mapStagingPrices: mapPrices,
    priceQuery: (printingIds) => repo.pricesByMarketplace(marketplace, printingIds),
    mapPriceRow: (row) => ({
      productName: row.productName,
      recordedAt: row.recordedAt.toISOString(),
      ...mapPrices(row),
    }),
  };
}

export type MarketplaceConfigs = Record<Marketplace, MarketplaceConfig>;

export function createMarketplaceConfigs(repos: Repos): MarketplaceConfigs {
  const repo = repos.marketplaceMapping;
  return {
    tcgplayer: createMarketplaceConfig("tcgplayer", repo),
    cardmarket: createMarketplaceConfig("cardmarket", repo),
    cardtrader: createMarketplaceConfig("cardtrader", repo),
    cardnexus: createMarketplaceConfig("cardnexus", repo),
  };
}
