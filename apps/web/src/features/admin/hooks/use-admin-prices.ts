import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import type { ClearPricesResponse, JobRunStartedResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { clearActions, refreshActions } from "@/features/admin/lib/refresh-actions";
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
  return useMutation({
    mutationFn: (): Promise<ClearPricesResponse> =>
      clearPricesFn({ data: { marketplace: clearAction.source } }),
  });
}
