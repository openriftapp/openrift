import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTradeActionStore } from "@/features/groups/stores/trade-action-store";
import { createStoreResetter } from "@/test/store-helpers";

interface Deferred {
  resolve: () => void;
  reject: (error: Error) => void;
}

const inFlight = new Map<string, Deferred>();
const declineFn = vi.fn(
  (variables: { tradeId: string }) =>
    new Promise<void>((resolve, reject) => {
      inFlight.set(variables.tradeId, { resolve, reject });
    }),
);

vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useAcceptTrade: () => useMutation({ mutationFn: async () => undefined }),
  useCancelTrade: () => useMutation({ mutationFn: async () => undefined }),
  useDeclineTrade: () => useMutation({ mutationFn: declineFn }),
}));

const { BulkTradeActions } = await import("./trade-bulk-actions");

function trade(id: string): CardTradeResponse {
  return {
    id,
    groupSlug: "friday-night",
    actionNeeded: "accept-or-decline",
    counterparty: { name: "Jinx" },
  } as unknown as CardTradeResponse;
}

const TRADES = [trade("t1"), trade("t2"), trade("t3")];
const resetActions = createStoreResetter(useTradeActionStore);

function renderBulk() {
  const client = new QueryClient({ defaultOptions: { mutations: { onError: () => {} } } });
  render(
    <QueryClientProvider client={client}>
      <BulkTradeActions trades={TRADES} mode="accept-decline" />
    </QueryClientProvider>,
  );
}

async function settleNext(tradeId: string, outcome: "ok" | "fail") {
  await waitFor(() => expect(inFlight.has(tradeId)).toBe(true));
  const deferred = inFlight.get(tradeId)!;
  inFlight.delete(tradeId);
  if (outcome === "ok") {
    deferred.resolve();
  } else {
    deferred.reject(new Error("This trade is no longer pending"));
  }
}

beforeEach(() => {
  inFlight.clear();
  declineFn.mockClear();
});
afterEach(resetActions);

describe("BulkTradeActions", () => {
  it("releases every row once its own request settles, including a failed one", async () => {
    renderBulk();
    await userEvent.setup().click(screen.getByRole("button", { name: /decline all/iu }));

    await settleNext("t1", "ok");
    await settleNext("t2", "fail");
    await settleNext("t3", "ok");

    await waitFor(() => expect(useTradeActionStore.getState().pending.size).toBe(0));
    expect(screen.getByRole("button", { name: /decline all/iu })).toBeEnabled();
  });

  it("sends one request at a time", async () => {
    renderBulk();
    await userEvent.setup().click(screen.getByRole("button", { name: /decline all/iu }));

    await waitFor(() => expect(declineFn).toHaveBeenCalledTimes(1));
    expect([...useTradeActionStore.getState().pending]).toEqual(["t1", "t2", "t3"]);

    await settleNext("t1", "ok");
    await waitFor(() => expect(declineFn).toHaveBeenCalledTimes(2));
    expect([...useTradeActionStore.getState().pending]).toEqual(["t2", "t3"]);
  });
});
