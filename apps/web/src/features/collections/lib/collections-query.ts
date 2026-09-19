import { collectionsContract } from "@openrift/shared/contracts/collections";
import { publicCollectionsContract } from "@openrift/shared/contracts/public-collections";
import type {
  CollectionListResponse,
  PublicCollectionDetailResponse,
} from "@openrift/shared/types/api/collection";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { collectionsKeys } from "@/features/collections/lib/collections-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCollections = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CollectionListResponse> =>
    apiOrpcClient(collectionsContract, context.cookie).list(),
  );

export function collectionsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: collectionsKeys.all(userId),
    queryFn: () => fetchCollections(),
    select: (data: CollectionListResponse) => data.items,
    // Default staleTime of 0 caused 3-4 fetches per navigation: each subscriber
    // that mounted post-fetch saw stale data and re-fetched.
    staleTime: 5 * 60 * 1000,
  });
}

const fetchPublicCollectionFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicCollectionDetailResponse> => {
    // 404 (unknown/expired token) is a typed NOT_FOUND error mapped to the
    // sentinel the route boundary expects.
    const client = apiOrpcClient(publicCollectionsContract);
    const { error, data: firstPage } = await safe(client.share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }

    // Walk the cursor server-side so the SSR payload carries every copy, matching
    // the authenticated `fetchCopies` pattern in copies-query.ts.
    const allCopies = [...firstPage.items];
    let cursor = firstPage.nextCursor;
    while (cursor) {
      const page = await client.share({ token, cursor });
      allCopies.push(...page.items);
      cursor = page.nextCursor;
    }

    return { ...firstPage, items: allCopies, nextCursor: null };
  });

export function publicCollectionQueryOptions(token: string) {
  return queryOptions({
    queryKey: collectionsKeys.publicByToken(token),
    queryFn: () => fetchPublicCollectionFn({ data: token }),
  });
}
