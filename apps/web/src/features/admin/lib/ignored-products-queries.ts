import { adminIgnoredProductsContract } from "@openrift/shared/contracts/admin/ignored-products";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { IgnoredProductsResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchIgnoredProducts = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<IgnoredProductsResponse> =>
    apiOrpcClient(adminIgnoredProductsContract, context.cookie).list(),
  );

export const ignoredProductsQueryOptions = queryOptions({
  queryKey: adminKeys.ignoredProducts,
  queryFn: () => fetchIgnoredProducts(),
});
