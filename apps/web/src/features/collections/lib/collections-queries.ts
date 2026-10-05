import { publicCollectionsContract } from "@openrift/shared/contracts/public-collections";
import type { PublicCollectionDetailResponse } from "@openrift/shared/types/api/collection";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { collectionsKeys } from "@/features/collections/lib/collections-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPublicCollectionFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicCollectionDetailResponse> => {
    const client = apiOrpcClient(publicCollectionsContract);
    const firstPage = await orNotFound(client.share({ token }));

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
