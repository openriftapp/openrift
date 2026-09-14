import type { AdminStatusResponse } from "@openrift/shared/contracts/admin/status";
import { adminStatusContract } from "@openrift/shared/contracts/admin/status";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchStatus = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminStatusResponse> =>
    apiOrpcClient(adminStatusContract, context.cookie).get(),
  );

export const ADMIN_STATUS_REFRESH_INTERVAL_MS = 30_000;

export const adminStatusQueryOptions = queryOptions({
  queryKey: adminKeys.status,
  queryFn: () => fetchStatus(),
  refetchInterval: ADMIN_STATUS_REFRESH_INTERVAL_MS,
});
