import type { AdminDeckFormatsResponse } from "@openrift/shared/contracts/admin/deck-formats";
import { adminDeckFormatsContract } from "@openrift/shared/contracts/admin/deck-formats";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchDeckFormats = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminDeckFormatsResponse> =>
    apiOrpcClient(adminDeckFormatsContract, context.cookie).list(),
  );

export const adminDeckFormatsQueryOptions = queryOptions({
  queryKey: adminKeys.deckFormats,
  queryFn: () => fetchDeckFormats(),
});
