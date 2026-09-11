import type { AdminGroupBannersResponse } from "@openrift/shared/contracts/admin/friend-group-banners";
import { adminFriendGroupBannersContract } from "@openrift/shared/contracts/admin/friend-group-banners";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

const fetchGroupBanners = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<AdminGroupBannersResponse> =>
    apiOrpcClient(adminFriendGroupBannersContract, context.cookie).list(),
  );

export const groupBannersQueryOptions = queryOptions({
  queryKey: adminKeys.groupBanners,
  queryFn: () => fetchGroupBanners(),
});

export function useGroupBanners() {
  return useSuspenseQuery(groupBannersQueryOptions);
}

const removeGroupBannerFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: groupId }) => {
    await apiOrpcClient(adminFriendGroupBannersContract, context.cookie).remove({ groupId });
  });

export function useRemoveGroupBanner() {
  return useMutationWithInvalidation({
    mutationFn: (groupId: string) => removeGroupBannerFn({ data: groupId }),
    invalidates: [adminKeys.groupBanners],
  });
}
