import type { AdminRaritiesResponse } from "@openrift/shared/contracts/admin/rarities";
import { adminRaritiesContract } from "@openrift/shared/contracts/admin/rarities";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchRarities = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminRaritiesResponse> =>
    apiOrpcClient(adminRaritiesContract, context.cookie).list(),
  );

export const adminRaritiesQueryOptions = queryOptions({
  queryKey: adminKeys.rarities,
  queryFn: () => fetchRarities(),
});
