import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupDetailResponse,
  FriendGroupListResponse,
} from "@openrift/shared/types/api/friend-group";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import type { ParsedLocation } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchGroups = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<FriendGroupListResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).list(),
  );

const fetchGroupDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<FriendGroupDetailResponse> =>
    orNotFound(apiOrpcClient(friendGroupsContract, context.cookie).get({ slug })),
  );

export function friendGroupsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: friendGroupsKeys.all(userId),
    queryFn: () => fetchGroups(),
  });
}

export function friendGroupDetailQueryOptions(userId: string, slug: string) {
  return queryOptions({
    queryKey: friendGroupsKeys.detail(userId, slug),
    queryFn: () => fetchGroupDetail({ data: slug }),
  });
}

/**
 * Redirects to the canonical slug when the API resolved a rename alias, so
 * bookmarks and trade-email links survive a group rename.
 */
export async function ensureFriendGroupDetailCanonical(options: {
  queryClient: QueryClient;
  userId: string;
  slug: string;
  location: ParsedLocation;
}): Promise<FriendGroupDetailResponse> {
  const { queryClient, userId, slug, location } = options;
  const detail = await queryClient.query({
    ...friendGroupDetailQueryOptions(userId, slug),
    staleTime: "static",
  });
  const canonical = detail.group.slug;
  if (canonical !== slug) {
    throw redirect({
      href: location.href.replace(`/groups/${slug}`, `/groups/${canonical}`),
      replace: true,
    });
  }
  return detail;
}
