import type { KeywordStatsResponse } from "@openrift/shared/contracts/admin/keywords";
import { adminKeywordsContract } from "@openrift/shared/contracts/admin/keywords";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchKeywordStats = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<KeywordStatsResponse> =>
    apiOrpcClient(adminKeywordsContract, context.cookie).stats(),
  );

export const keywordStatsQueryOptions = queryOptions({
  queryKey: adminKeys.keywordStats,
  queryFn: () => fetchKeywordStats(),
});
