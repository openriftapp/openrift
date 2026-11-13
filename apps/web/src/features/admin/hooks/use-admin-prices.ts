import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import type { ClearPricesResponse } from "@openrift/shared/types/api/admin";
import type { Marketplace } from "@openrift/shared/types/pricing";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const clearPricesFn = createServerFn({ method: "POST" })
  .validator((input: { marketplace: Marketplace }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ClearPricesResponse> =>
    apiOrpcClient(adminOperationsContract, context.cookie).clearPrices({
      marketplace: data.marketplace,
    }),
  );

export function useClearPrices(marketplace: Marketplace) {
  return useMutationWithInvalidation({
    mutationFn: (): Promise<ClearPricesResponse> => clearPricesFn({ data: { marketplace } }),
    invalidates: [adminKeys.marketplaceGroups, adminKeys.marketplace(marketplace)],
  });
}
