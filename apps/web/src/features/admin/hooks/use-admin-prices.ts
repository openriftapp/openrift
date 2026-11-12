import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import type { ClearPricesResponse, JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { clearActions, refreshActions } from "@/features/admin/lib/refresh-actions";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const clearPricesFn = createServerFn({ method: "POST" })
  // The oRPC client enforces the route's marketplace enum; callers pass
  // clearActions[*].source, which is already one of these literals.
  .validator((input: { marketplace: Marketplace }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ClearPricesResponse> =>
    apiOrpcClient(adminOperationsContract, context.cookie).clearPrices({
      marketplace: data.marketplace,
    }),
  );

export function useRefreshPrices(marketplace: Marketplace) {
  const refreshAction = refreshActions[marketplace];
  return useMutation({
    mutationFn: (): Promise<JobRunStartedResponse> =>
      refreshAction.post() as Promise<JobRunStartedResponse>,
  });
}

export function useClearPrices(marketplace: Marketplace) {
  const clearAction = clearActions[marketplace];
  return useMutationWithInvalidation({
    mutationFn: (): Promise<ClearPricesResponse> =>
      clearPricesFn({ data: { marketplace: clearAction.source } }),
    invalidates: [adminKeys.marketplaceGroups, adminKeys.marketplace(marketplace)],
  });
}
