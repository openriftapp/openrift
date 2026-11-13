import { adminOperationsContract } from "@openrift/shared/contracts/admin/operations";
import type { SiblingVariantDriftResponse } from "@openrift/shared/types/api/admin";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const siblingVariantDriftFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<SiblingVariantDriftResponse> =>
    apiOrpcClient(adminOperationsContract, context.cookie).siblingVariantDrift(),
  );

export function useSiblingVariantDrift(isBackfillRunning: boolean) {
  return useQuery({
    queryKey: adminKeys.siblingVariantDrift,
    queryFn: (): Promise<SiblingVariantDriftResponse> => siblingVariantDriftFn(),
    refetchInterval: isBackfillRunning ? 5000 : 60_000,
  });
}
