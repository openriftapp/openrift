import { adminCatalogWorkspaceContract } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { WorkspaceQueueResponse } from "@openrift/shared/contracts/admin/catalog-workspace";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { listingsOverview } from "@/features/catalog-workspace/lib/listings";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchListingItems = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<WorkspaceQueueResponse> =>
    apiOrpcClient(adminCatalogWorkspaceContract, context.cookie).workspaceListings(),
  );

export function listingsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.workspaceListings,
    queryFn: async () => {
      const queue = await fetchListingItems();
      return listingsOverview(queue.items);
    },
    staleTime: MINUTE_MS,
  });
}
