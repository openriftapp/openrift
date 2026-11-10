import { cardTradesContract } from "@openrift/shared/contracts/card-trades";
import type {
  CardTradeSheetResponse,
  CardTradeStatus,
  TradeSuggestionDismissalListResponse,
} from "@openrift/shared/types/api/card-trade";
import { queryOptions, skipToken } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { tradesKeys } from "@/features/groups/lib/groups-query-keys";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

export const fetchUserTrades = createServerFn({ method: "GET" })
  .validator((input: { groupId?: string; status?: CardTradeStatus } | undefined) => input ?? {})
  .middleware([withCookies])
  .handler(({ context, data }) => {
    const query: { groupId?: string; status?: CardTradeStatus } = {};
    if (data.groupId !== undefined) {
      query.groupId = data.groupId;
    }
    if (data.status !== undefined) {
      query.status = data.status;
    }
    return apiOrpcClient(cardTradesContract, context.cookie).list(query);
  });

const fetchTradeSheet = createServerFn({ method: "GET" })
  .validator((input: string) => input)
  .middleware([withCookies])
  .handler(({ context, data: memberId }): Promise<CardTradeSheetResponse> =>
    apiOrpcClient(cardTradesContract, context.cookie).withUser({ userId: memberId }),
  );

const fetchTradeDismissals = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<TradeSuggestionDismissalListResponse> =>
    apiOrpcClient(cardTradesContract, context.cookie).dismissals(),
  );

const fetchLiveTradesByPrinting = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }) => apiOrpcClient(cardTradesContract, context.cookie).liveByPrinting());

/** Shared by the card browsers' trade markers and the deck builder's incoming counts, so both read one cached response. */
export function liveTradesByPrintingQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: tradesKeys.liveByPrinting(userId ?? ""),
    queryFn: userId === null ? skipToken : () => fetchLiveTradesByPrinting(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function tradeDismissalsQueryOptions(userId: string) {
  return queryOptions({
    queryKey: tradesKeys.dismissals(userId),
    queryFn: () => fetchTradeDismissals(),
  });
}

export function userTradesQueryOptions(userId: string | null) {
  return queryOptions({
    queryKey: tradesKeys.all(userId ?? ""),
    queryFn: userId === null ? skipToken : () => fetchUserTrades({ data: {} }),
    staleTime: 0,
  });
}

export function tradeSheetQueryOptions(userId: string, memberId: string) {
  return queryOptions({
    queryKey: tradesKeys.sheet(userId, memberId),
    queryFn: () => fetchTradeSheet({ data: memberId }),
    staleTime: 0,
  });
}
