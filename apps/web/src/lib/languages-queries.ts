import type { AdminLanguagesResponse } from "@openrift/shared/contracts/admin/languages";
import { adminLanguagesContract } from "@openrift/shared/contracts/admin/languages";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchLanguages = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminLanguagesResponse> =>
    apiOrpcClient(adminLanguagesContract, context.cookie).list(),
  );

export const adminLanguagesQueryOptions = queryOptions({
  queryKey: adminKeys.languages,
  queryFn: () => fetchLanguages(),
  staleTime: 30 * 60 * 1000,
});
