import { boardStatesContract } from "@openrift/shared/contracts/board-states";
import type {
  BoardStateResponse,
  BoardStateShareResponse,
} from "@openrift/shared/types/api/board-state";
import { isDefinedError, safe } from "@orpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import {
  boardStateQueryOptions,
  boardStatesQueryOptions,
  featuredBoardStatesQueryOptions,
  publicBoardStateQueryOptions,
} from "@/features/rules/lib/board-states-queries";
import { boardStatesKeys } from "@/features/rules/lib/rules-query-keys";
import { useRequiredUserId, useUserId } from "@/lib/auth-session";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

type CreateBoardStateBody = ContractInput<typeof boardStatesContract, "create">;
type UpdateBoardStateBody = ContractInput<typeof boardStatesContract, "update">;

export function useBoardStates() {
  return useSuspenseQuery(boardStatesQueryOptions(useRequiredUserId()));
}

export function useBoardState(id: string) {
  return useSuspenseQuery(boardStateQueryOptions(useRequiredUserId(), id));
}

export function usePublicBoardState(token: string) {
  return useSuspenseQuery(publicBoardStateQueryOptions(token));
}

export function useFeaturedBoardStates() {
  return useSuspenseQuery(featuredBoardStatesQueryOptions());
}

const createBoardStateFn = createServerFn({ method: "POST" })
  .validator((input: CreateBoardStateBody) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<BoardStateResponse> =>
    apiOrpcClient(boardStatesContract, context.cookie).create(data),
  );

/** Usable on a public route: the builder at /board-states/new creates once the viewer signs in. */
export function useCreateBoardState() {
  const userId = useUserId();
  return useMutationWithInvalidation<BoardStateResponse, CreateBoardStateBody>({
    mutationFn: (body) => createBoardStateFn({ data: body }),
    invalidates: userId ? [boardStatesKeys.all(userId)] : [],
  });
}

const updateBoardStateFn = createServerFn({ method: "POST" })
  .validator((input: UpdateBoardStateBody) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<BoardStateResponse> =>
    apiOrpcClient(boardStatesContract, context.cookie).update(data),
  );

export function useUpdateBoardState() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<BoardStateResponse, UpdateBoardStateBody>({
    mutationFn: (body) => updateBoardStateFn({ data: body }),
    invalidates: (variables) => [
      boardStatesKeys.detail(userId, variables.id),
      boardStatesKeys.all(userId),
    ],
  });
}

const deleteBoardStateFn = createServerFn({ method: "POST" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(async ({ context, data: id }) => {
    const { error } = await safe(apiOrpcClient(boardStatesContract, context.cookie).remove({ id }));
    if (error) {
      if (isDefinedError(error) && error.code === "NOT_FOUND") {
        return;
      }
      throw error;
    }
  });

export function useDeleteBoardState() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<unknown, string>({
    mutationFn: (id) => deleteBoardStateFn({ data: id }),
    invalidates: [boardStatesKeys.all(userId)],
  });
}

const setBoardStateShareFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; shared: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }): Promise<BoardStateShareResponse> => {
    const client = apiOrpcClient(boardStatesContract, context.cookie);
    if (!data.shared) {
      await client.unshare({ id: data.id });
      return { shareToken: null, isPublic: false };
    }
    return client.share({ id: data.id });
  });

export function useSetBoardStateShare() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<BoardStateShareResponse, { id: string; shared: boolean }>({
    mutationFn: (body) => setBoardStateShareFn({ data: body }),
    invalidates: (variables) => [
      boardStatesKeys.detail(userId, variables.id),
      boardStatesKeys.all(userId),
    ],
  });
}
