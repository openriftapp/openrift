import { publicDecksContract } from "@openrift/shared/contracts/public-decks";
import type { PublicDeckDetailResponse } from "@openrift/shared/types/api/deck";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { decksKeys } from "@/features/decks/lib/decks-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchPublicDeckFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicDeckDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(publicDecksContract).share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

export function publicDeckQueryOptions(token: string) {
  return queryOptions({
    queryKey: decksKeys.publicByToken(token),
    queryFn: () => fetchPublicDeckFn({ data: token }),
  });
}
