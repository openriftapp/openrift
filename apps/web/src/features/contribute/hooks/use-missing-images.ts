import { cardSubmissionsContract } from "@openrift/shared/contracts/card-submissions";
import type { MissingImagesResponse } from "@openrift/shared/contracts/card-submissions";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { cardSubmissionsKeys } from "@/features/contribute/lib/contribute-query-keys";
import { useUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchMissingImagesFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<MissingImagesResponse> =>
    apiOrpcClient(cardSubmissionsContract, context.cookie).missingImages(),
  );

/** The API scopes to the session user; `userId` here only keys the cache. */
function missingImagesQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: cardSubmissionsKeys.missingImages(userId ?? ""),
    queryFn:
      userId === null ? skipToken : (): Promise<MissingImagesResponse> => fetchMissingImagesFn(),
    staleTime: 60_000,
  });
}

export function useMyMissingImages() {
  const userId = useUserId();
  return useQuery(missingImagesQueryOptions(userId));
}
