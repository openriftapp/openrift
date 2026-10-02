import { adminRulesContract } from "@openrift/shared/contracts/admin/rules";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAdminRuleVersions = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) => apiOrpcClient(adminRulesContract, context.cookie).listVersions({}));

export function adminRuleVersionsQueryOptions() {
  return queryOptions({
    queryKey: adminKeys.rules.versions,
    queryFn: () => fetchAdminRuleVersions(),
  });
}
