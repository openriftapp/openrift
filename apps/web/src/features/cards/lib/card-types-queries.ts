import type { AdminCardTypesResponse } from "@openrift/shared/contracts/admin/card-types";
import { adminCardTypesContract } from "@openrift/shared/contracts/admin/card-types";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCardTypes = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminCardTypesResponse> =>
    apiOrpcClient(adminCardTypesContract, context.cookie).list(),
  );

export const adminCardTypesQueryOptions = queryOptions({
  queryKey: adminKeys.cardTypes,
  queryFn: () => fetchCardTypes(),
});
