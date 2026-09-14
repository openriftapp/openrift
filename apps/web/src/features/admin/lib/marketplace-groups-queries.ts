import type { MarketplaceGroupsResponse } from "@openrift/shared/contracts/admin/marketplace-groups";
import { adminMarketplaceGroupsContract } from "@openrift/shared/contracts/admin/marketplace-groups";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMarketplaceGroups = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MarketplaceGroupsResponse> =>
    apiOrpcClient(adminMarketplaceGroupsContract, context.cookie).list(),
  );

export const marketplaceGroupsQueryOptions = queryOptions({
  queryKey: adminKeys.marketplaceGroups,
  queryFn: () => fetchMarketplaceGroups(),
});
