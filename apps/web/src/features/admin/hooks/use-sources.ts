import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import type { CatalogSourcesResponse } from "@openrift/shared/contracts/admin/catalog-review";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchSources = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CatalogSourcesResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).catalogSources(),
  );

export const sourcesQueryOptions = queryOptions({
  queryKey: adminKeys.sources,
  queryFn: () => fetchSources(),
  staleTime: 60 * 1000,
});

export function useSources() {
  return useQuery(sourcesQueryOptions);
}
