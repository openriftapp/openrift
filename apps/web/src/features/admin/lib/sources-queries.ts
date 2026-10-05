import { adminCardQueriesContract } from "@openrift/shared/contracts/admin/card-queries";
import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import type { CatalogSourcesResponse } from "@openrift/shared/contracts/admin/catalog-review";
import { queryOptions } from "@tanstack/react-query";
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

export const exportCatalogFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(async ({ context }): Promise<string> => {
    const data = await apiOrpcClient(adminCardQueriesContract, context.cookie).exportCandidates();
    return JSON.stringify(data, null, 2);
  });
