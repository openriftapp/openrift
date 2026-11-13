import { featureFlagsContract } from "@openrift/shared/contracts/feature-flags";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { featureFlagsKeys, serverCacheKeys } from "@/lib/query-keys";

import { serverCache } from "./server-cache";
import { withCookies } from "./server-fns/middleware";
import { apiOrpcClient } from "./server-fns/orpc-client";
import { hasSessionCookie } from "./session-cookie";

export type FeatureFlags = Record<string, boolean>;

async function fetchFlagsFromApi(cookie?: string): Promise<FeatureFlags> {
  const data = await apiOrpcClient(featureFlagsContract, cookie).get();
  return data.flags;
}

export function loadFeatureFlags(cookie: string): Promise<FeatureFlags> {
  if (hasSessionCookie(cookie)) {
    // serverCache is a single global key; sharing it here would leak one
    // user's overrides to another.
    return fetchFlagsFromApi(cookie);
  }
  return serverCache.query({
    queryKey: serverCacheKeys.featureFlags,
    queryFn: () => fetchFlagsFromApi(),
  });
}

const fetchFeatureFlags = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) => loadFeatureFlags(context.cookie));

export const featureFlagsQueryOptions = queryOptions({
  queryKey: featureFlagsKeys.all,
  queryFn: () => fetchFeatureFlags(),
  staleTime: 5 * 60 * 1000, // 5 minutes
  refetchOnWindowFocus: false,
});

export function featureEnabled(flags: FeatureFlags, key: string): boolean {
  return flags[key] === true;
}
