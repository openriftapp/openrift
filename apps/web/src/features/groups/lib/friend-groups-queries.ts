import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupDetailResponse,
  FriendGroupListResponse,
  FriendGroupMemberDetailResponse,
  FriendGroupSharedCollectionDetailResponse,
  FriendGroupSharedListDetailResponse,
} from "@openrift/shared/types/api/friend-group";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import type { ParsedLocation } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { notFoundOnSentinel, orNotFound } from "@/lib/server-fns/api-error";
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

const fetchSharedList = createServerFn({ method: "GET" })
  .validator((input: { slug: string; listId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<FriendGroupSharedListDetailResponse> =>
    orNotFound(apiOrpcClient(friendGroupsContract, context.cookie).getSharedList(data)),
  );

const fetchSharedCollection = createServerFn({ method: "GET" })
  .validator((input: { slug: string; collectionId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<FriendGroupSharedCollectionDetailResponse> =>
    orNotFound(apiOrpcClient(friendGroupsContract, context.cookie).getSharedCollection(data)),
  );

const fetchMemberDetail = createServerFn({ method: "GET" })
  .validator((input: { slug: string; userId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<FriendGroupMemberDetailResponse> =>
    orNotFound(apiOrpcClient(friendGroupsContract, context.cookie).getMemberDetail(data)),
  );

export function friendGroupMemberDetailQueryOptions(
  userId: string,
  slug: string,
  memberUserId: string,
) {
  return queryOptions({
    queryKey: friendGroupsKeys.memberDetail(userId, slug, memberUserId),
    queryFn: () => fetchMemberDetail({ data: { slug, userId: memberUserId } }),
  });
}

export function friendGroupSharedListQueryOptions(userId: string, slug: string, listId: string) {
  return queryOptions({
    queryKey: friendGroupsKeys.sharedList(userId, slug, listId),
    queryFn: () => fetchSharedList({ data: { slug, listId } }),
  });
}

export function friendGroupSharedCollectionQueryOptions(
  userId: string,
  slug: string,
  collectionId: string,
) {
  return queryOptions({
    queryKey: friendGroupsKeys.sharedCollection(userId, slug, collectionId),
    queryFn: () => fetchSharedCollection({ data: { slug, collectionId } }),
  });
}

/**
 * Redirects to the canonical slug when the API resolved a rename alias, so
 * bookmarks and trade-email links survive a group rename. A group the viewer
 * cannot see is the router's not-found page.
 */
export async function ensureFriendGroupDetailCanonical(options: {
  queryClient: QueryClient;
  userId: string;
  slug: string;
  location: ParsedLocation;
  alongside?: Promise<unknown>;
}): Promise<FriendGroupDetailResponse> {
  const { queryClient, userId, slug, location, alongside } = options;
  const [settled, extra] = await Promise.allSettled([
    notFoundOnSentinel(
      queryClient.query({ ...friendGroupDetailQueryOptions(userId, slug), staleTime: "static" }),
    ),
    alongside,
  ]);
  if (settled.status === "rejected") {
    throw settled.reason;
  }
  const detail = settled.value;
  const canonical = detail.group.slug;
  if (canonical !== slug) {
    throw redirect({
      href: location.href.replace(`/groups/${slug}`, `/groups/${canonical}`),
      replace: true,
    });
  }
  if (extra.status === "rejected") {
    throw extra.reason;
  }
  return detail;
}
