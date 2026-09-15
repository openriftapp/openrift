import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupCalendarFeedKind,
  FriendGroupCalendarFeedResponse,
  FriendGroupCalendarFeedsResponse,
} from "@openrift/shared/types/api/friend-group";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

interface CalendarFeedTarget {
  slug: string;
  kind: FriendGroupCalendarFeedKind;
}

const fetchCalendarFeeds = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<FriendGroupCalendarFeedsResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).listCalendarFeeds({ slug }),
  );

const enableCalendarFeedFn = createServerFn({ method: "POST" })
  .validator((input: CalendarFeedTarget) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<FriendGroupCalendarFeedResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).enableCalendarFeed(data),
  );

const disableCalendarFeedFn = createServerFn({ method: "POST" })
  .validator((input: CalendarFeedTarget) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(friendGroupsContract, context.cookie).disableCalendarFeed(data);
  });

export function useFriendGroupCalendarFeeds(slug: string) {
  const userId = useRequiredUserId();
  return useQuery({
    queryKey: friendGroupsKeys.calendarFeeds(userId, slug),
    queryFn: () => fetchCalendarFeeds({ data: slug }),
  });
}

export function useEnableFriendGroupCalendarFeed() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<FriendGroupCalendarFeedResponse, CalendarFeedTarget>({
    mutationFn: (data) => enableCalendarFeedFn({ data }),
    invalidates: (variables) => [friendGroupsKeys.calendarFeeds(userId, variables.slug)],
  });
}

export function useDisableFriendGroupCalendarFeed() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, CalendarFeedTarget>({
    mutationFn: (data) => disableCalendarFeedFn({ data }),
    invalidates: (variables) => [friendGroupsKeys.calendarFeeds(userId, variables.slug)],
  });
}
