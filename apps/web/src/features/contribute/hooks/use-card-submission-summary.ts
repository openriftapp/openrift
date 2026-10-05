import { cardSubmissionsContract } from "@openrift/shared/contracts/card-submissions";
import type { CardSubmissionSummaryResponse } from "@openrift/shared/contracts/card-submissions";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { cardSubmissionsKeys } from "@/features/contribute/lib/contribute-query-keys";
import { useUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchCardSubmissionSummaryFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<CardSubmissionSummaryResponse> =>
    apiOrpcClient(cardSubmissionsContract, context.cookie).summary(),
  );

/** The API scopes to the session user; `userId` here only keys the cache. */
function cardSubmissionSummaryQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: cardSubmissionsKeys.summary(userId ?? ""),
    queryFn:
      userId === null
        ? skipToken
        : (): Promise<CardSubmissionSummaryResponse> => fetchCardSubmissionSummaryFn(),
    staleTime: 60_000,
  });
}

export function useCardSubmissionSummary() {
  const userId = useUserId();
  return useQuery(cardSubmissionSummaryQueryOptions(userId));
}
