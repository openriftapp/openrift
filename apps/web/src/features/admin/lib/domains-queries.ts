import type { AdminDomainsResponse } from "@openrift/shared/contracts/admin/domains";
import { adminDomainsContract } from "@openrift/shared/contracts/admin/domains";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchDomains = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminDomainsResponse> =>
    apiOrpcClient(adminDomainsContract, context.cookie).list(),
  );

export const adminDomainsQueryOptions = queryOptions({
  queryKey: adminKeys.domains,
  queryFn: () => fetchDomains(),
});
