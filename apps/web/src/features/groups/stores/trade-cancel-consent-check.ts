import type { TradeCancelConflictData } from "@openrift/shared/contracts/fields";
import type { QueryClient } from "@tanstack/react-query";

import { liveTradesByPrintingQueryOptions } from "@/features/groups/lib/card-trades-queries";
import type { TradeCancelConsent } from "@/features/groups/lib/trade-cancel-conflict";
import { hasPendingGiverTrade } from "@/features/groups/lib/trade-cancel-conflict";
import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";
import { UserDeclinedError } from "@/lib/user-declined-error";

export function dialogTradeCancelConsent(tradeIds: readonly string[] = []): TradeCancelConsent {
  return {
    tradeIds: new Set(tradeIds),
    ask: (trades) => useTradeCancelConsentStore.getState().ask(trades),
  };
}

/**
 * Asks once, before anything is written, about the trades the whole action would cancel. The
 * check request is skipped when the viewer's live trades show no pending trade where they give
 * one of `printingIds` (any printing when omitted), and a failed check lets the write go ahead.
 * The write's own refusal covers what either misses.
 */
export async function consentBeforeTradeCancels(options: {
  queryClient: QueryClient;
  userId: string;
  printingIds?: ReadonlySet<string>;
  check: () => Promise<TradeCancelConflictData>;
}): Promise<TradeCancelConsent> {
  const live = await options.queryClient
    .query({ ...liveTradesByPrintingQueryOptions(options.userId), staleTime: "static" })
    .catch(() => null);
  if (
    Array.isArray(live?.annotations) &&
    !hasPendingGiverTrade(live.annotations, options.printingIds)
  ) {
    return dialogTradeCancelConsent();
  }
  // A copy whose add is still in flight is unknown to the check; the write waits for it.
  const { trades } = await options.check().catch(() => ({ trades: [] }));
  if (trades.length === 0) {
    return dialogTradeCancelConsent();
  }
  if (!(await useTradeCancelConsentStore.getState().ask(trades))) {
    throw new UserDeclinedError();
  }
  return dialogTradeCancelConsent(trades.map((trade) => trade.id));
}
