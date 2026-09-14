import type { AdminGroupBannersResponse } from "@openrift/shared/contracts/admin/friend-group-banners";
import { adminFriendGroupBannersContract } from "@openrift/shared/contracts/admin/friend-group-banners";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchGroupBanners = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminGroupBannersResponse> =>
    apiOrpcClient(adminFriendGroupBannersContract, context.cookie).list(),
  );

export const groupBannersQueryOptions = queryOptions({
  queryKey: adminKeys.groupBanners,
  queryFn: () => fetchGroupBanners(),
});
