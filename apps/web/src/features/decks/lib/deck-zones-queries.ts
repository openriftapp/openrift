import type { AdminDeckZonesResponse } from "@openrift/shared/contracts/admin/deck-zones";
import { adminDeckZonesContract } from "@openrift/shared/contracts/admin/deck-zones";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchDeckZones = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminDeckZonesResponse> =>
    apiOrpcClient(adminDeckZonesContract, context.cookie).list(),
  );

export const adminDeckZonesQueryOptions = queryOptions({
  queryKey: adminKeys.deckZones,
  queryFn: () => fetchDeckZones(),
});
