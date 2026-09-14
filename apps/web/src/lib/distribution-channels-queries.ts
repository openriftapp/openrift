import type { AdminDistributionChannelsResponse } from "@openrift/shared/contracts/admin/distribution-channels";
import { adminDistributionChannelsContract } from "@openrift/shared/contracts/admin/distribution-channels";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchChannels = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminDistributionChannelsResponse> =>
    apiOrpcClient(adminDistributionChannelsContract, context.cookie).list(),
  );

export const adminDistributionChannelsQueryOptions = queryOptions({
  queryKey: adminKeys.distributionChannels,
  queryFn: () => fetchChannels(),
  staleTime: 30 * 60 * 1000,
});
