import { decksContract } from "@openrift/shared/contracts/decks";
import { publicDecksContract } from "@openrift/shared/contracts/public-decks";
import type {
  DeckDetailResponse,
  DeckListResponse,
  PublicDeckDetailResponse,
} from "@openrift/shared/types/api/deck";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { decksKeys } from "@/features/decks/lib/decks-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchDecks = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<DeckListResponse> =>
    apiOrpcClient(decksContract, context.cookie).list({ includeArchived: "true" }),
  );

async function fetchDeckDetailImpl(
  cookie: string | undefined,
  deckId: string,
): Promise<DeckDetailResponse> {
  const { error, data } = await safe(apiOrpcClient(decksContract, cookie).get({ id: deckId }));
  if (error) {
    // The route matches this exact message to render its not-found page.
    if (isDefinedError(error) && error.code === "NOT_FOUND") {
      throw new Error("NOT_FOUND");
    }
    throw error;
  }
  return data;
}

const fetchDeckDetail = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: deckId }) => fetchDeckDetailImpl(context.cookie, deckId));

export function decksQueryOptions(userId: string) {
  return queryOptions({
    queryKey: decksKeys.all(userId),
    queryFn: () => fetchDecks(),
    select: (data: DeckListResponse) => data.items,
    staleTime: 5 * 60 * 1000,
  });
}

export function deckDetailQueryOptions(userId: string, deckId: string) {
  return queryOptions({
    queryKey: decksKeys.detail(userId, deckId),
    queryFn: (): Promise<DeckDetailResponse> => fetchDeckDetail({ data: deckId }),
  });
}

const fetchPublicDeckFn = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicDeckDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(publicDecksContract).share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw new Error("NOT_FOUND");
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
