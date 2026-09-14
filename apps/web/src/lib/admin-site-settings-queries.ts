import type { AdminSiteSettingsResponse } from "@openrift/shared/contracts/admin/site-settings";
import { adminSiteSettingsContract } from "@openrift/shared/contracts/admin/site-settings";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchAdminSiteSettings = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminSiteSettingsResponse> =>
    apiOrpcClient(adminSiteSettingsContract, context.cookie).list(),
  );

export const adminSiteSettingsQueryOptions = queryOptions({
  queryKey: adminKeys.siteSettings,
  queryFn: () => fetchAdminSiteSettings(),
});
