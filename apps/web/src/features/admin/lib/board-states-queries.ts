import type { AdminBoardStatesResponse } from "@openrift/shared/contracts/admin/board-states";
import { adminBoardStatesContract } from "@openrift/shared/contracts/admin/board-states";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAdminBoardStates = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminBoardStatesResponse> =>
    apiOrpcClient(adminBoardStatesContract, context.cookie).list(),
  );

export const adminBoardStatesQueryOptions = queryOptions({
  queryKey: adminKeys.boardStates,
  queryFn: () => fetchAdminBoardStates(),
});
