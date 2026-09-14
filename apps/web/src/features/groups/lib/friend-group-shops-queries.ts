import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type { FriendGroupShopEventsResponse } from "@openrift/shared/types/api/friend-group";
import { createServerFn } from "@tanstack/react-start";

import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchShopEvents = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<FriendGroupShopEventsResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).shopEvents({ slug }),
  );

export function friendGroupShopEventsQueryOptions(userId: string, slug: string) {
  return {
    queryKey: friendGroupsKeys.shopEvents(userId, slug),
    queryFn: () => fetchShopEvents({ data: slug }),
  };
}
