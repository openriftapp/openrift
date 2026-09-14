import { adminIgnoredCandidatesContract } from "@openrift/shared/contracts/admin/ignored-candidates";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { IgnoredCandidatesResponse } from "@/lib/server-fns/api-types";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchIgnoredCandidates = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<IgnoredCandidatesResponse> =>
    apiOrpcClient(adminIgnoredCandidatesContract, context.cookie).list(),
  );

export const ignoredCandidatesQueryOptions = queryOptions({
  queryKey: adminKeys.ignoredCandidates,
  queryFn: () => fetchIgnoredCandidates(),
});
