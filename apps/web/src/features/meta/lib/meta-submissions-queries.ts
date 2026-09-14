import { metaSubmissionsContract } from "@openrift/shared/contracts/meta-submissions";
import type { MetaSubmissionListResponse } from "@openrift/shared/types/api/meta";
import { infiniteQueryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { metaSubmissionsKeys } from "@/features/meta/lib/meta-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMetaSubmissionsFn = createServerFn({ method: "GET" })
  .validator((input: { cursor?: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<MetaSubmissionListResponse> =>
    apiOrpcClient(metaSubmissionsContract, context.cookie).list(
      data.cursor ? { cursor: data.cursor } : {},
    ),
  );

/** The endpoint scopes to the session user; `userId` here only keys the cache. */
export function metaSubmissionsQueryOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: metaSubmissionsKeys.all(userId),
    queryFn: ({ pageParam }): Promise<MetaSubmissionListResponse> =>
      fetchMetaSubmissionsFn({
        data: { cursor: pageParam },
      }) as Promise<MetaSubmissionListResponse>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: MetaSubmissionListResponse) => lastPage.nextCursor ?? undefined,
  });
}
