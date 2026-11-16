import { featureFlagsContract } from "@openrift/shared/contracts/feature-flags";
import { MINUTE_MS } from "@openrift/shared/format-date";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { featureFlagsKeys, serverCacheKeys } from "@/lib/query-keys";

import { captureHandledError } from "./report-error";
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
  queryFn: (): Promise<FeatureFlags> => fetchFeatureFlags(),
  staleTime: 5 * MINUTE_MS,
  refetchOnWindowFocus: false,
});

export function featureEnabled(flags: FeatureFlags, key: string): boolean {
  return flags[key] === true;
}

export class FeatureFlagsUnavailableError extends Error {
  constructor() {
    super("Feature flags could not be loaded");
    this.name = "FeatureFlagsUnavailableError";
  }
}

/** True while the cached flags are the seed of a failed fetch; a real fetch never stamps 0. */
export function featureFlagsUnknown(queryClient: QueryClient): boolean {
  return (queryClient.getQueryState(featureFlagsQueryOptions.queryKey)?.dataUpdatedAt ?? 0) === 0;
}

/** A failed fetch seeds `{}` so `useSuspenseQuery` consumers do not re-throw the cached error. */
export async function prefetchFeatureFlags(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.query({ ...featureFlagsQueryOptions, staleTime: "static" });
  } catch (error) {
    console.error("[feature-flags] fetch failed, flags unknown", error);
    captureHandledError(error, { query: "feature-flags" });
    queryClient.setQueryData(featureFlagsQueryOptions.queryKey, {}, { updatedAt: 0 });
  }
}

export async function refetchUnknownFeatureFlags(queryClient: QueryClient): Promise<void> {
  if (!featureFlagsUnknown(queryClient)) {
    return;
  }
  await queryClient.query({ ...featureFlagsQueryOptions, staleTime: 0 }).catch(() => null);
}

async function knownFeatureFlags(queryClient: QueryClient): Promise<FeatureFlags> {
  const flags = await queryClient.query({ ...featureFlagsQueryOptions, staleTime: "static" });
  if (!featureFlagsUnknown(queryClient)) {
    return flags;
  }
  // The server render already failed this fetch once; the browser retries it.
  if (globalThis.window === undefined) {
    throw new FeatureFlagsUnavailableError();
  }
  return queryClient.query({ ...featureFlagsQueryOptions, staleTime: 0 });
}

export async function requireFeature(queryClient: QueryClient, key: string): Promise<void> {
  const flags = await knownFeatureFlags(queryClient);
  if (!featureEnabled(flags, key)) {
    throw notFound();
  }
}
