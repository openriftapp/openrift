import { cardTradesContract } from "@openrift/shared/contracts/card-trades";
import type {
  CardTradeSheetResponse,
  CardTradeStatus,
} from "@openrift/shared/types/api/card-trade";
import { queryOptions } from "@tanstack/react-query";
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

export function userTradesQueryOptions(userId: string) {
  return queryOptions({
    queryKey: tradesKeys.all(userId),
    queryFn: () => fetchUserTrades({ data: {} }),
  });
}

export function tradeSheetQueryOptions(userId: string, memberId: string) {
  return queryOptions({
    queryKey: tradesKeys.sheet(userId, memberId),
    queryFn: () => fetchTradeSheet({ data: memberId }),
  });
}
