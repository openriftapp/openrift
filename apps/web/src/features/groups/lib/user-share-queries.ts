import { publicUserShareContract } from "@openrift/shared/contracts/public-user-share";
import type { PublicListDetailResponse } from "@openrift/shared/types/api/list";
import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { userShareKeys } from "@/features/groups/lib/groups-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

// Forwards the viewer's session cookie so the API can apply the friend-group
// visibility bypass; anonymous viewers still resolve, restricted to lists
// with their own public share token.
const fetchPublicUserBundleFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .validator((input: string) => input)
  .handler(async ({ context, data: token }): Promise<PublicUserBundleResponse> => {
    const { error, data } = await safe(
      apiOrpcClient(publicUserShareContract, context.cookie).bundle({ token }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function publicUserBundleQueryOptions(token: string) {
  return queryOptions({
    queryKey: userShareKeys.publicByToken(token),
    queryFn: () => fetchPublicUserBundleFn({ data: token }),
  });
}

const fetchPublicUserBundleListFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .validator((input: { token: string; listId: string }) => input)
  .handler(async ({ context, data }): Promise<PublicListDetailResponse> => {
    const { error, data: result } = await safe(
      apiOrpcClient(publicUserShareContract, context.cookie).bundleList({
        token: data.token,
        listId: data.listId,
      }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return result;
  });

export function publicUserBundleListQueryOptions(token: string, listId: string) {
  return queryOptions({
    queryKey: userShareKeys.publicListByToken(token, listId),
    queryFn: () => fetchPublicUserBundleListFn({ data: { token, listId } }),
  });
}
