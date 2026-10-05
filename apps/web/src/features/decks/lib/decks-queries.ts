import { publicDecksContract } from "@openrift/shared/contracts/public-decks";
import type { PublicDeckDetailResponse } from "@openrift/shared/types/api/deck";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { decksKeys } from "@/features/decks/lib/decks-query-keys";
import { orNotFound } from "@/lib/server-fns/api-error";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPublicDeckFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(({ data: token }): Promise<PublicDeckDetailResponse> =>
    orNotFound(apiOrpcClient(publicDecksContract).share({ token })),
  );

export function publicDeckQueryOptions(token: string) {
  return queryOptions({
    queryKey: decksKeys.publicByToken(token),
    queryFn: () => fetchPublicDeckFn({ data: token }),
  });
}
