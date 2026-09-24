import { cardTradesContract } from "@openrift/shared/contracts/card-trades";
import type {
  TradeSuggestionDismissal,
  TradeSuggestionDismissalListResponse,
} from "@openrift/shared/types/api/card-trade";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tradeDismissalsQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { tradesKeys } from "@/features/groups/lib/groups-query-keys";
import { withDismissals, withoutDismissal } from "@/features/groups/lib/trade-dismissals";
import { useRequiredUserId } from "@/lib/auth-session";
import { reportMutationError } from "@/lib/query-client";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const dismissFn = createServerFn({ method: "POST" })
  .validator((input: TradeSuggestionDismissal[]) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const client = apiOrpcClient(cardTradesContract, context.cookie);
    for (const dismissal of data) {
      await client.dismiss(dismissal);
    }
  });

const restoreFn = createServerFn({ method: "POST" })
  .validator((input: TradeSuggestionDismissal) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(cardTradesContract, context.cookie).restoreDismissal(data);
  });

export function useTradeDismissals(): TradeSuggestionDismissal[] {
  const userId = useRequiredUserId();
  const { data } = useQuery(tradeDismissalsQueryOptions(userId));
  return data?.items ?? [];
}

function useOptimisticDismissals<TVariables>(
  send: (variables: TVariables) => Promise<unknown>,
  apply: (
    items: readonly TradeSuggestionDismissal[],
    variables: TVariables,
  ) => TradeSuggestionDismissal[],
) {
  const userId = useRequiredUserId();
  const queryClient = useQueryClient();
  const queryKey = tradesKeys.dismissals(userId);
  return useMutation<
    unknown,
    Error,
    TVariables,
    { prev: TradeSuggestionDismissalListResponse | undefined }
  >({
    mutationFn: send,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<TradeSuggestionDismissalListResponse>(queryKey);
      queryClient.setQueryData<TradeSuggestionDismissalListResponse>(queryKey, {
        items: apply(prev?.items ?? [], variables),
      });
      return { prev };
    },
    onError: (error, _variables, context) => {
      if (context?.prev !== undefined) {
        queryClient.setQueryData(queryKey, context.prev);
      }
      // Replaces the QueryClient's default onError; report here or the revert is silent.
      reportMutationError(error, queryClient);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useDismissSuggestions() {
  return useOptimisticDismissals<TradeSuggestionDismissal[]>(
    (dismissals) => dismissFn({ data: dismissals }),
    withDismissals,
  );
}

export function useRestoreSuggestion() {
  return useOptimisticDismissals<TradeSuggestionDismissal>(
    (dismissal) => restoreFn({ data: dismissal }),
    withoutDismissal,
  );
}
