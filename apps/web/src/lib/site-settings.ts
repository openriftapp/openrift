import { siteSettingsContract } from "@openrift/shared/contracts/site-settings";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { serverCacheKeys, siteSettingsKeys } from "@/lib/query-keys";

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
