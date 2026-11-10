import type { CardTradeLiveAnnotation } from "@openrift/shared/types/api/card-trade";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { consentBeforeTradeCancels } from "@/features/groups/stores/trade-cancel-consent-check";
import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";
import { UserDeclinedError } from "@/lib/user-declined-error";

vi.mock("@/features/groups/lib/card-trades-queries", () => ({
  liveTradesByPrintingQueryOptions: (userId: string) => ({
    queryKey: ["trades", userId, "live-by-printing"],
    queryFn: () => Promise.reject(new Error("offline")),
  }),
}));

const TRADE = {
  id: "trade-1",
  cardId: "card-1",
  printingId: "printing-1",
  quantity: 2,
  counterpartyName: "Mara",
};

async function nextRequest() {
  await vi.waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
  return useTradeCancelConsentStore.getState().request!;
}

describe("consentBeforeTradeCancels", () => {
  const liveKey = ["trades", "user-1", "live-by-printing"];

  function clientWithLiveTrades(annotations?: CardTradeLiveAnnotation[]) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (annotations) {
      queryClient.setQueryData(liveKey, { annotations });
    }
    return queryClient;
  }

  const giving: CardTradeLiveAnnotation = {
    printingId: "printing-1",
    role: "giver",
    phase: "asked",
    tradeCount: 1,
    quantity: 2,
  };

  beforeEach(() => {
    useTradeCancelConsentStore.setState({ request: null });
  });

  it("skips the check when the viewer gives none of the printings in a pending trade", async () => {
    const check = vi.fn();

    const consent = await consentBeforeTradeCancels({
      queryClient: clientWithLiveTrades([{ ...giving, printingId: "printing-2" }]),
      userId: "user-1",
      printingIds: new Set(["printing-1"]),
      check,
    });

    expect(check).not.toHaveBeenCalled();
    expect(consent.tradeIds.size).toBe(0);
  });

  it("runs the check when the live trades cannot be read", async () => {
    const check = vi.fn(async () => ({ trades: [] }));

    await consentBeforeTradeCancels({
      queryClient: clientWithLiveTrades(),
      userId: "user-1",
      printingIds: new Set(["printing-1"]),
      check,
    });

    expect(check).toHaveBeenCalledTimes(1);
  });

  it("asks about the trades the check names and confirms their ids", async () => {
    const pending = consentBeforeTradeCancels({
      queryClient: clientWithLiveTrades([giving]),
      userId: "user-1",
      printingIds: new Set(["printing-1"]),
      check: async () => ({ trades: [TRADE] }),
    });
    const request = await nextRequest();
    expect(request.trades).toEqual([TRADE]);
    useTradeCancelConsentStore.getState().answer(true);

    const consent = await pending;
    expect([...consent.tradeIds]).toEqual([TRADE.id]);
  });

  it("rejects with UserDeclinedError when the user keeps the trades", async () => {
    const pending = consentBeforeTradeCancels({
      queryClient: clientWithLiveTrades([giving]),
      userId: "user-1",
      check: async () => ({ trades: [TRADE] }),
    });
    await nextRequest();
    useTradeCancelConsentStore.getState().answer(false);

    await expect(pending).rejects.toBeInstanceOf(UserDeclinedError);
  });
});
