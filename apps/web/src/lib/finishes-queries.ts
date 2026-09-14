import type { AdminFinishesResponse } from "@openrift/shared/contracts/admin/finishes";
import { adminFinishesContract } from "@openrift/shared/contracts/admin/finishes";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchFinishes = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminFinishesResponse> =>
    apiOrpcClient(adminFinishesContract, context.cookie).list(),
  );

export const adminFinishesQueryOptions = queryOptions({
  queryKey: adminKeys.finishes,
  queryFn: () => fetchFinishes(),
});
