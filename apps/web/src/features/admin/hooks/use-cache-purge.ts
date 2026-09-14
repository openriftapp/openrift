import { adminCacheContract } from "@openrift/shared/contracts/admin/cache";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminCacheStatusQueryOptions } from "@/features/admin/lib/cache-purge-queries";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useCacheStatus() {
  return useSuspenseQuery(adminCacheStatusQueryOptions);
}

const purgeCacheFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(async ({ context }) => {
    // The oRPC client throws on a non-2xx with the API's message (e.g.
    // "Cloudflare credentials not configured"), surfaced in the toast.
    await apiOrpcClient(adminCacheContract, context.cookie).purge();
  });

export function usePurgeCache() {
  return useMutationWithInvalidation({
    mutationFn: () => purgeCacheFn(),
    invalidates: [adminKeys.cacheStatus],
  });
}
