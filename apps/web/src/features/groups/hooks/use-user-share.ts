import { userShareContract } from "@openrift/shared/contracts/user-share";
import type { UserShareStateResponse } from "@openrift/shared/types/api/user-share";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { userShareKeys } from "@/features/groups/lib/groups-query-keys";
import {
  publicUserBundleListQueryOptions,
  publicUserBundleQueryOptions,
} from "@/features/groups/lib/user-share-queries";
import { useRequiredUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchUserShareStateFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<UserShareStateResponse> =>
    apiOrpcClient(userShareContract, context.cookie).get(),
  );

function userShareStateQueryOptions(userId: string) {
  return queryOptions({
    queryKey: userShareKeys.state(userId),
    queryFn: () => fetchUserShareStateFn(),
  });
}

/** Non-suspense: used by inline UI (share dialog, profile section), not a route boundary. */
export function useUserShareState() {
  const userId = useRequiredUserId();
  return useQuery(userShareStateQueryOptions(userId));
}

const enableUserShareFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(({ context }): Promise<UserShareStateResponse> =>
    apiOrpcClient(userShareContract, context.cookie).enable(),
  );

const disableUserShareFn = createServerFn({ method: "POST" })
  .middleware([withCookies])
  .handler(async ({ context }) => {
    await apiOrpcClient(userShareContract, context.cookie).disable();
  });

export function useEnableUserShare() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => enableUserShareFn(),
    onSuccess: (data) => {
      queryClient.setQueryData<UserShareStateResponse>(userShareKeys.state(userId), data);
    },
  });
}

export function useDisableUserShare() {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disableUserShareFn(),
    onSuccess: () => {
      queryClient.setQueryData<UserShareStateResponse>(userShareKeys.state(userId), {
        shareToken: null,
        isPublic: false,
      });
    },
  });
}

export function usePublicUserBundle(token: string) {
  return useSuspenseQuery(publicUserBundleQueryOptions(token));
}

export function usePublicUserBundleList(token: string, listId: string) {
  return useSuspenseQuery(publicUserBundleListQueryOptions(token, listId));
}
