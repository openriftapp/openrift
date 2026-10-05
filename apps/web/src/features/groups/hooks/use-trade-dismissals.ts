import { cardTradesContract } from "@openrift/shared/contracts/card-trades";
import type {
  TradeSuggestionDismissal,
  TradeSuggestionDismissalListResponse,
} from "@openrift/shared/types/api/card-trade";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tradeDismissalsQueryOptions } from "@/features/groups/lib/card-trades-queries";
import { tradesKeys } from "@/features/groups/lib/groups-query-keys";
import { withDismissals, withoutDismissal } from "@/features/groups/lib/trade-dismissals";
import { useOptimisticMutation } from "@/hooks/use-optimistic-mutation";
import { useRequiredUserId } from "@/hooks/use-session";
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
  return useOptimisticMutation<TradeSuggestionDismissalListResponse, TVariables>({
    queryKey: tradesKeys.dismissals(userId),
    mutationFn: send,
    apply: (cached, variables) => ({ items: apply(cached.items, variables) }),
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
