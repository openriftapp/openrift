import { listsContract } from "@openrift/shared/contracts/lists";
import { publicListsContract } from "@openrift/shared/contracts/public-lists";
import type {
  ListDetailResponse,
  ListIntent,
  ListListResponse,
  PublicListDetailResponse,
} from "@openrift/shared/types/api/list";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { listsKeys } from "@/features/lists/lib/lists-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchLists = createServerFn({ method: "GET" })
  .validator((input: { intent?: ListIntent } | undefined) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ListListResponse> =>
    apiOrpcClient(listsContract, context.cookie).list(data?.intent ? { intent: data.intent } : {}),
  );

const fetchListDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: listId }): Promise<ListDetailResponse> => {
    // 404 (unknown list, or one belonging to another user) maps to the
    // NOT_FOUND sentinel the route boundary expects.
    const { error, data } = await safe(
      apiOrpcClient(listsContract, context.cookie).get({ id: listId }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw new Error("NOT_FOUND");
      }
      throw error;
    }
    return data;
  });

// 404 (unknown/non-public token) is a typed NOT_FOUND error mapped to the
// sentinel the caller expects.
const fetchPublicListFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicListDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(publicListsContract).share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw new Error("NOT_FOUND");
      }
      throw error;
    }
    return data;
  });

export function listsQueryOptions(userId: string, intent?: ListIntent) {
  return queryOptions({
    queryKey: listsKeys.all(userId, intent),
    queryFn: () => fetchLists({ data: intent ? { intent } : undefined }),
    select: (data: ListListResponse) => data.items,
    staleTime: 5 * 60 * 1000,
  });
}

export function listDetailQueryOptions(userId: string, listId: string) {
  return queryOptions({
    queryKey: listsKeys.detail(userId, listId),
    queryFn: () => fetchListDetail({ data: listId }),
  });
}

export function publicListQueryOptions(token: string) {
  return queryOptions({
    queryKey: listsKeys.publicByToken(token),
    queryFn: () => fetchPublicListFn({ data: token }),
  });
}
