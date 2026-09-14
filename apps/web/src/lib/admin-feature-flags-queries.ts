import type {
  AdminFeatureFlagOverridesResponse,
  AdminFeatureFlagsResponse,
} from "@openrift/shared/contracts/admin/feature-flags";
import { adminFeatureFlagsContract } from "@openrift/shared/contracts/admin/feature-flags";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAdminFeatureFlags = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminFeatureFlagsResponse> =>
    apiOrpcClient(adminFeatureFlagsContract, context.cookie).list(),
  );

export const adminFeatureFlagsQueryOptions = queryOptions({
  queryKey: adminKeys.featureFlags,
  queryFn: () => fetchAdminFeatureFlags(),
});

const fetchAdminFeatureFlagOverrides = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminFeatureFlagOverridesResponse> =>
    apiOrpcClient(adminFeatureFlagsContract, context.cookie).listOverrides(),
  );

export const adminFeatureFlagOverridesQueryOptions = queryOptions({
  queryKey: adminKeys.featureFlagOverrides,
  queryFn: () => fetchAdminFeatureFlagOverrides(),
});
