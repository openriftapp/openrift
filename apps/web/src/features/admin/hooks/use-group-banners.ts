import { adminFriendGroupBannersContract } from "@openrift/shared/contracts/admin/friend-group-banners";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { groupBannersQueryOptions } from "@/features/admin/lib/group-banners-queries";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

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
