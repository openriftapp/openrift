import { loansContract } from "@openrift/shared/contracts/loans";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { loansKeys } from "@/features/groups/lib/groups-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchLoans = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) => apiOrpcClient(loansContract, context.cookie).list());

export function loansQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: loansKeys.all(userId ?? ""),
    queryFn: userId === null ? skipToken : () => fetchLoans(),
  });
}
