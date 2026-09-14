import type { ProviderSettingsResponse } from "@openrift/shared/contracts/admin/provider-settings";
import { adminProviderSettingsContract } from "@openrift/shared/contracts/admin/provider-settings";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchProviderSettings = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ProviderSettingsResponse> =>
    apiOrpcClient(adminProviderSettingsContract, context.cookie).list(),
  );

export const providerSettingsQueryOptions = queryOptions({
  queryKey: adminKeys.providerSettings,
  queryFn: () => fetchProviderSettings(),
  staleTime: 30 * 60 * 1000,
});
