import { adminCatalogContract } from "@openrift/shared/contracts/admin/catalog";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { AdminSetsResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchSets = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminSetsResponse> =>
    apiOrpcClient(adminCatalogContract, context.cookie).listSets(),
  );

export const setsQueryOptions = queryOptions({
  queryKey: adminKeys.sets,
  queryFn: () => fetchSets(),
});
