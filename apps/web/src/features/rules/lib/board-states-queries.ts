import { boardStatesContract } from "@openrift/shared/contracts/board-states";
import { publicBoardStatesContract } from "@openrift/shared/contracts/public-board-states";
import type {
  BoardStateListResponse,
  BoardStateResponse,
  FeaturedBoardStateListResponse,
  PublicBoardStateDetailResponse,
} from "@openrift/shared/types/api/board-state";
import { isDefinedError, safe } from "@orpc/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { boardStatesKeys } from "@/features/rules/lib/rules-query-keys";
import { notFoundError } from "@/lib/server-fns/api-error";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const fetchBoardStates = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<BoardStateListResponse> =>
    apiOrpcClient(boardStatesContract, context.cookie).list(),
  );

const fetchBoardState = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }): Promise<BoardStateResponse> => {
    const { error, data } = await safe(
      apiOrpcClient(boardStatesContract, context.cookie).get({ id }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchPublicBoardState = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .handler(async ({ data: token }): Promise<PublicBoardStateDetailResponse> => {
    const { error, data } = await safe(apiOrpcClient(publicBoardStatesContract).share({ token }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        throw notFoundError();
      }
      throw error;
    }
    return data;
  });

const fetchFeaturedBoardStates = createServerFn({ method: "GET" }).handler(
  (): Promise<FeaturedBoardStateListResponse> =>
    apiOrpcClient(publicBoardStatesContract).featured(),
);

export function boardStatesQueryOptions(userId: string) {
  return queryOptions({
    queryKey: boardStatesKeys.all(userId),
    queryFn: () => fetchBoardStates(),
    select: (data: BoardStateListResponse) => data.items,
  });
}

export function boardStateQueryOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: boardStatesKeys.detail(userId, id),
    queryFn: (): Promise<BoardStateResponse> => fetchBoardState({ data: id }),
  });
}

export function publicBoardStateQueryOptions(token: string) {
  return queryOptions({
    queryKey: boardStatesKeys.publicByToken(token),
    queryFn: (): Promise<PublicBoardStateDetailResponse> => fetchPublicBoardState({ data: token }),
  });
}

export function featuredBoardStatesQueryOptions() {
  return queryOptions({
    queryKey: boardStatesKeys.featured(),
    queryFn: () => fetchFeaturedBoardStates(),
    select: (data: FeaturedBoardStateListResponse) => data.items,
  });
}
