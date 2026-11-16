import { siteSettingsContract } from "@openrift/shared/contracts/site-settings";
import { MINUTE_MS } from "@openrift/shared/format-date";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { serverCacheKeys, siteSettingsKeys } from "@/lib/query-keys";

import { captureHandledError } from "./report-error";
import { serverCache } from "./server-cache";
import { apiOrpcClient } from "./server-fns/orpc-client";

type SiteSettings = Record<string, string>;

const fetchSiteSettings = createServerFn({ method: "GET" }).handler(() =>
  serverCache.query({
    queryKey: serverCacheKeys.siteSettings,
    queryFn: async () => {
      const data = await apiOrpcClient(siteSettingsContract).get();
      return data.settings;
    },
  }),
);

export const siteSettingsQueryOptions = queryOptions({
  queryKey: siteSettingsKeys.all,
  queryFn: (): Promise<SiteSettings> => fetchSiteSettings(),
  staleTime: 5 * MINUTE_MS,
});

/** A failed fetch seeds empty, stale settings; the shell's observer refetches them after hydration. */
export async function prefetchSiteSettings(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.query({ ...siteSettingsQueryOptions, staleTime: "static" });
  } catch (error) {
    console.error("[site-settings] fetch failed, rendering without settings", error);
    captureHandledError(error, { query: "site-settings" });
    queryClient.setQueryData(siteSettingsQueryOptions.queryKey, {}, { updatedAt: 0 });
  }
}
