import { publicTierListsContract } from "@openrift/shared/contracts/public-tier-lists";
import { tierListsContract } from "@openrift/shared/contracts/tier-lists";
import type {
  PublicTierListDetailResponse,
  TierListListResponse,
  TierListResponse,
} from "@openrift/shared/types/api/tier-list";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tierListsKeys } from "@/features/stage/lib/stage-query-keys";
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
  .handler(async ({ context, data: id }): Promise<TierListResponse> => {
    // 404 here is expected (deleted list, or another user's): map to NOT_FOUND, not an error.
    const { error, data } = await safe(
      apiOrpcClient(tierListsContract, context.cookie).get({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw new Error("NOT_FOUND");
      }
      throw error;
    }
    return data;
  });

const fetchPublicTierList = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ data: token }): Promise<PublicTierListDetailResponse> => {
    // No cookie forwarded: share links must resolve for a logged-out viewer.
    const { error, data } = await safe(apiOrpcClient(publicTierListsContract).share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw new Error("NOT_FOUND");
      }
      throw error;
    }
    return data;
  });

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
