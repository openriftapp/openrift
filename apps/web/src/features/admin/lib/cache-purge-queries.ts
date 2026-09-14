import { adminCacheContract } from "@openrift/shared/contracts/admin/cache";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

interface CacheStatusResponse {
  configured: boolean;
}

const fetchCacheStatus = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CacheStatusResponse> =>
    apiOrpcClient(adminCacheContract, context.cookie).status(),
  );

export const adminCacheStatusQueryOptions = queryOptions({
  queryKey: adminKeys.cacheStatus,
  queryFn: () => fetchCacheStatus(),
});
