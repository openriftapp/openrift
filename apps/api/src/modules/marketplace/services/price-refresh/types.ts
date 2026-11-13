import type { PriceRefreshUpsertCounts } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";

export interface UpsertCounts {
  prices: PriceRefreshUpsertCounts;
}

export interface PriceUpsertConfig {
  marketplace: Marketplace;
}

export interface GroupRow {
  groupId: number;
  name?: string;
  abbreviation?: string;
}

export const PRICE_FETCH_RETRIES = 2;
