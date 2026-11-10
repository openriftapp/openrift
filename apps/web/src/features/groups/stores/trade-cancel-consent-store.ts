import { create } from "zustand";

import type { CancelledTrade } from "@/features/groups/lib/trade-cancel-conflict";
import { tradeCancelConflict } from "@/features/groups/lib/trade-cancel-conflict";
import { UserDeclinedError } from "@/lib/user-declined-error";

interface ConsentRequest {
  trades: CancelledTrade[];
  resolve: (confirmed: boolean) => void;
}

interface TradeCancelConsentState {
  request: ConsentRequest | null;
  ask: (trades: CancelledTrade[]) => Promise<boolean>;
  answer: (confirmed: boolean) => void;
}

export const useTradeCancelConsentStore = create<TradeCancelConsentState>()((set, get) => ({
  request: null,
  ask: (trades) => {
    get().request?.resolve(false);
    // oxlint-disable-next-line promise/avoid-new -- settles when the user answers the dialog
    return new Promise<boolean>((resolve) => {
      set({ request: { trades, resolve } });
    });
  },
  answer: (confirmed) => {
    const { request } = get();
    set({ request: null });
    request?.resolve(confirmed);
  },
}));

/** Asks before an edit cancels trades the server named, then retries with their ids; a decline
 * rejects with {@link UserDeclinedError}, and a refusal of ids already confirmed is rethrown. */
export async function withTradeCancelConsent<T>(
  call: (cancelTradeIds?: string[]) => Promise<T>,
): Promise<T> {
  let cancelTradeIds: string[] | undefined;
  for (;;) {
    try {
      return await call(cancelTradeIds);
    } catch (error) {
      const conflict = tradeCancelConflict(error);
      const asked = new Set(cancelTradeIds);
      if (conflict === undefined || conflict.trades.every((trade) => asked.has(trade.id))) {
        throw error;
      }
      const confirmed = await useTradeCancelConsentStore.getState().ask(conflict.trades);
      if (!confirmed) {
        throw new UserDeclinedError();
      }
      cancelTradeIds = conflict.trades.map((trade) => trade.id);
    }
  }
}
