import type { AdminSuperTypesResponse } from "@openrift/shared/contracts/admin/super-types";
import { adminSuperTypesContract } from "@openrift/shared/contracts/admin/super-types";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchSuperTypes = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminSuperTypesResponse> =>
    apiOrpcClient(adminSuperTypesContract, context.cookie).list(),
  );

export const adminSuperTypesQueryOptions = queryOptions({
  queryKey: adminKeys.superTypes,
  queryFn: () => fetchSuperTypes(),
});
