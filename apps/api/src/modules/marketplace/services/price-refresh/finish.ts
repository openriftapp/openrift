import type { Logger } from "@openrift/shared/logger";
import type { PriceRefreshResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";

import type { Repos } from "../../../../deps.js";
import type { StagingRow } from "../../lib/marketplace-configs.js";
import type { LoadedIgnoredKeys } from "../../repositories/price-refresh.js";
import { logFetchSummary, logUpsertCounts } from "./log.js";
import type { GroupRow } from "./types.js";
import { loadIgnoredKeys, upsertMarketplaceGroups, upsertPriceData } from "./upsert.js";

export async function finishPriceRefresh(
  repos: Repos,
  log: Logger,
  marketplace: Marketplace,
  run: {
    ignoredKeys: LoadedIgnoredKeys;
    transformed: PriceRefreshResponse["transformed"];
    staging: StagingRow[];
  },
): Promise<PriceRefreshResponse> {
  logFetchSummary(
    log,
    run.transformed,
    run.ignoredKeys.productIds.size + run.ignoredKeys.variantKeys.size,
  );
  const counts = await upsertPriceData(repos.priceRefresh, log, marketplace, run.staging);
  logUpsertCounts(log, counts);
  await repos.marketplace.refreshLatestPrices();
  return { transformed: run.transformed, upserted: counts };
}

export async function refreshFetchedPrices<T>(
  repos: Repos,
  log: Logger,
  marketplace: Marketplace,
  source: {
    fetch: () => Promise<T>;
    staging: (fetched: T, ignoredKeys: LoadedIgnoredKeys) => StagingRow[];
    groups: (fetched: T) => GroupRow[];
    products: (fetched: T) => number;
  },
): Promise<PriceRefreshResponse> {
  const ignoredKeys = await loadIgnoredKeys(repos.priceRefresh, marketplace);
  const fetched = await source.fetch();
  const staging = source.staging(fetched, ignoredKeys);
  const groupRows = source.groups(fetched);
  await upsertMarketplaceGroups(repos.priceRefresh, marketplace, groupRows);
  return finishPriceRefresh(repos, log, marketplace, {
    ignoredKeys,
    transformed: {
      groups: groupRows.length,
      products: source.products(fetched),
      prices: staging.length,
    },
    staging,
  });
}
