import { friendGroupsContract } from "@openrift/shared/contracts/friend-groups";
import type {
  FriendGroupShareableCollectionsResponse,
  FriendGroupShareableListsResponse,
} from "@openrift/shared/types/api/friend-group";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { collectionsKeys } from "@/features/collections/lib/collections-query-keys";
import {
  friendGroupSharedCollectionQueryOptions,
  friendGroupSharedListQueryOptions,
} from "@/features/groups/lib/friend-groups-queries";
import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { withTradeCancelConsent } from "@/features/groups/stores/trade-cancel-consent-store";
import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useRequiredUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient, browserApiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchShareableLists = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<FriendGroupShareableListsResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).shareableLists({ slug }),
  );

const fetchShareableCollections = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: slug }): Promise<FriendGroupShareableCollectionsResponse> =>
    apiOrpcClient(friendGroupsContract, context.cookie).shareableCollections({ slug }),
  );

export function useFriendGroupSharedList(slug: string, listId: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(friendGroupSharedListQueryOptions(userId, slug, listId));
}

export function useFriendGroupShareableLists(slug: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(
    queryOptions({
      queryKey: friendGroupsKeys.shareableLists(userId, slug),
      queryFn: () => fetchShareableLists({ data: slug }),
    }),
  );
}

export function useFriendGroupShareableCollections(slug: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(
    queryOptions({
      queryKey: friendGroupsKeys.shareableCollections(userId, slug),
      queryFn: () => fetchShareableCollections({ data: slug }),
    }),
  );
}

export function useFriendGroupSharedCollection(slug: string, collectionId: string) {
  const userId = useRequiredUserId();
  return useSuspenseQuery(friendGroupSharedCollectionQueryOptions(userId, slug, collectionId));
}

const shareListFn = createServerFn({ method: "POST" })
  .validator((input: { slug: string; listId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(friendGroupsContract, context.cookie).shareList(data);
  });

const shareCollectionFn = createServerFn({ method: "POST" })
  .validator((input: { slug: string; collectionId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(friendGroupsContract, context.cookie).shareCollection(data);
  });

const unshareCollectionFn = createServerFn({ method: "POST" })
  .validator((input: { slug: string; collectionId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(friendGroupsContract, context.cookie).unshareCollection(data);
  });

export function useShareListWithFriendGroup() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { slug: string; listId: string }>({
    mutationFn: (data) => shareListFn({ data }),
    invalidates: (variables) => [
      friendGroupsKeys.detail(userId, variables.slug),
      friendGroupsKeys.shareableLists(userId, variables.slug),
      friendGroupsKeys.matches(userId, variables.slug),
      listsKeys.groupShares(userId, variables.listId),
    ],
  });
}

export function useUnshareListFromFriendGroup() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { slug: string; listId: string }>({
    mutationFn: (data) =>
      withTradeCancelConsent((cancelTradeIds) =>
        browserApiOrpcClient(friendGroupsContract).unshareList({ ...data, cancelTradeIds }),
      ),
    invalidates: (variables) => [
      friendGroupsKeys.detail(userId, variables.slug),
      friendGroupsKeys.shareableLists(userId, variables.slug),
      friendGroupsKeys.matches(userId, variables.slug),
      listsKeys.groupShares(userId, variables.listId),
    ],
  });
}

export function useShareCollectionWithFriendGroup() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { slug: string; collectionId: string }>({
    mutationFn: (data) => shareCollectionFn({ data }),
    invalidates: (variables) => [
      friendGroupsKeys.detail(userId, variables.slug),
      friendGroupsKeys.shareableCollections(userId, variables.slug),
      collectionsKeys.groupShares(userId, variables.collectionId),
    ],
  });
}

export function useUnshareCollectionFromFriendGroup() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, { slug: string; collectionId: string }>({
    mutationFn: (data) => unshareCollectionFn({ data }),
    invalidates: (variables) => [
      friendGroupsKeys.detail(userId, variables.slug),
      friendGroupsKeys.shareableCollections(userId, variables.slug),
      collectionsKeys.groupShares(userId, variables.collectionId),
    ],
  });
}
