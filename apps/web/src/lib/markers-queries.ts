import type { AdminMarkersResponse } from "@openrift/shared/contracts/admin/markers";
import { adminMarkersContract } from "@openrift/shared/contracts/admin/markers";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMarkers = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminMarkersResponse> =>
    apiOrpcClient(adminMarkersContract, context.cookie).list(),
  );

export const adminMarkersQueryOptions = queryOptions({
  queryKey: adminKeys.markers,
  queryFn: () => fetchMarkers(),
  staleTime: 30 * 60 * 1000,
});
