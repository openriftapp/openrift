import { adminStatusContract } from "@openrift/shared/contracts/admin/status";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminStatusQueryOptions } from "@/features/admin/lib/status-queries";
import { serverCache } from "@/lib/server-cache";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const clearSsrCache = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(async ({ context }) => {
    // Discarded result: this call exists only for its admin auth check.
    await apiOrpcClient(adminStatusContract, context.cookie).get();
    serverCache.clear();
  });

export function useAdminStatus() {
  return useQuery(adminStatusQueryOptions);
}

export function useClearSsrCache() {
  return useMutation({
    mutationFn: () => clearSsrCache(),
  });
}
