import { publicTierListsContract } from "@openrift/shared/contracts/public-tier-lists";
import { tierListsContract } from "@openrift/shared/contracts/tier-lists";
import type {
  PublicTierListDetailResponse,
  TierListListResponse,
  TierListResponse,
} from "@openrift/shared/types/api/tier-list";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tierListsKeys } from "@/features/stage/lib/stage-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchTierLists = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<TierListListResponse> =>
    apiOrpcClient(tierListsContract, context.cookie).list(),
  );

const fetchTierList = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: id }): Promise<TierListResponse> =>
    orNotFound(apiOrpcClient(tierListsContract, context.cookie).get({ id })),
  );

const fetchPublicTierList = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ data: token }): Promise<PublicTierListDetailResponse> =>
    // No cookie forwarded: share links must resolve for a logged-out viewer.
    orNotFound(apiOrpcClient(publicTierListsContract).share({ token })),
  );

export function tierListsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: tierListsKeys.all(userId),
    queryFn: () => fetchTierLists(),
    select: (data: TierListListResponse) => data.items,
  });
}

export function tierListQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: tierListsKeys.detail(userId, id),
    queryFn: (): Promise<TierListResponse> => fetchTierList({ data: id }),
  });
}

export function publicTierListQueryOptions(token: string) {
  return queryOptions({
    queryKey: tierListsKeys.publicByToken(token),
    queryFn: (): Promise<PublicTierListDetailResponse> => fetchPublicTierList({ data: token }),
  });
}
