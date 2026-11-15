import { adminCatalogReviewContract } from "@openrift/shared/contracts/admin/catalog-review";
import type { ReviewQueueResponse } from "@openrift/shared/contracts/admin/catalog-review";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchReviewQueue = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ReviewQueueResponse> =>
    apiOrpcClient(adminCatalogReviewContract, context.cookie).reviewQueue(),
  );

export const reviewQueueQueryOptions = queryOptions({
  queryKey: adminKeys.reviewQueue,
  queryFn: () => fetchReviewQueue(),
  staleTime: MINUTE_MS,
});
