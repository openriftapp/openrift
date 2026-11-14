import type { PriceRefreshUpsertCounts } from "@openrift/shared/types/api/admin";

export interface UpsertCounts {
  prices: PriceRefreshUpsertCounts;
}

export interface GroupRow {
  groupId: number;
  name?: string;
  abbreviation?: string;
}

export const PRICE_FETCH_RETRIES = 2;
