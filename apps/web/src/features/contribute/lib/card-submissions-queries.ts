import { cardSubmissionsContract } from "@openrift/shared/contracts/card-submissions";
import type {
  CardSubmissionListResponse,
  MissingImagesResponse,
} from "@openrift/shared/contracts/card-submissions";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { cardSubmissionsKeys } from "@/features/contribute/lib/contribute-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCardSubmissionsFn = createServerFn({ method: "GET" })
  .validator((input: { cursor?: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<CardSubmissionListResponse> =>
    apiOrpcClient(cardSubmissionsContract, context.cookie).list(
      data.cursor ? { cursor: data.cursor } : {},
    ),
  );

/** The API scopes to the session user; `userId` here only keys the cache. */
export function cardSubmissionsQueryOptions(userId: string) {
  return infiniteQueryOptions({
    queryKey: cardSubmissionsKeys.all(userId),
    queryFn: ({ pageParam }): Promise<CardSubmissionListResponse> =>
      fetchCardSubmissionsFn({
        data: { cursor: pageParam },
      }) as Promise<CardSubmissionListResponse>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: CardSubmissionListResponse) => lastPage.nextCursor ?? undefined,
  });
}

const fetchMissingImagesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MissingImagesResponse> =>
    apiOrpcClient(cardSubmissionsContract, context.cookie).missingImages(),
  );

/** The API scopes to the session user; `userId` here only keys the cache. */
export function missingImagesQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: cardSubmissionsKeys.missingImages(userId ?? ""),
    queryFn:
      userId === null ? skipToken : (): Promise<MissingImagesResponse> => fetchMissingImagesFn(),
    staleTime: MINUTE_MS,
  });
}
