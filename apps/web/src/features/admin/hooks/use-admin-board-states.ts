import type { AdminBoardState } from "@openrift/shared/contracts/admin/board-states";
import { adminBoardStatesContract } from "@openrift/shared/contracts/admin/board-states";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { adminBoardStatesQueryOptions } from "@/features/admin/lib/board-states-queries";
import { boardStatesKeys } from "@/features/rules/lib/rules-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

export function useAdminBoardStates() {
  return useSuspenseQuery(adminBoardStatesQueryOptions);
}

const setBoardStateFeaturedFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; featured: boolean }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<AdminBoardState> =>
    apiOrpcClient(adminBoardStatesContract, context.cookie).setFeatured(data),
  );

export function useSetBoardStateFeatured() {
  return useMutationWithInvalidation<AdminBoardState, { id: string; featured: boolean }>({
    mutationFn: (vars) => setBoardStateFeaturedFn({ data: vars }),
    invalidates: [adminKeys.boardStates, boardStatesKeys.featured()],
  });
}
