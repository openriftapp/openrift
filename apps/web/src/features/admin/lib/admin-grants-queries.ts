import type { AdminGrantsResponse } from "@openrift/shared/contracts/admin/grants";
import { adminGrantsContract } from "@openrift/shared/contracts/admin/grants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAdminGrants = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminGrantsResponse> =>
    apiOrpcClient(adminGrantsContract, context.cookie).list(),
  );

export const adminGrantsQueryOptions = queryOptions({
  queryKey: adminKeys.grants,
  queryFn: () => fetchAdminGrants(),
});
