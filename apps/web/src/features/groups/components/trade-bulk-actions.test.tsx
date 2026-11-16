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

const acceptFn = vi.fn(async (_variables: { tradeId: string }) => undefined);
const copyOptionsFn = vi.fn(async (tradeId: string) => ({
  tradeId,
  quantity: 1,
  choiceMatters: tradeId === "t2",
  copies: [],
}));

vi.mock("@/hooks/use-session", () => ({ useRequiredUserId: () => "user-1" }));
vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  tradeCopyOptionsQueryOptions: (_userId: string, tradeId: string) => ({
    queryKey: ["copy-options", tradeId],
    queryFn: () => copyOptionsFn(tradeId),
  }),
  useAcceptTrade: () => useMutation({ mutationFn: acceptFn }),
  useCancelTrade: () => useMutation({ mutationFn: async () => undefined }),
  useDeclineTrade: () => useMutation({ mutationFn: declineFn }),
}));

const { BulkTradeActions } = await import("./trade-bulk-actions");

function trade(id: string, role: "giver" | "receiver" = "giver"): CardTradeResponse {
  return {
    id,
    role,
    groupSlug: "friday-night",
    actionNeeded: "accept-or-decline",
    counterparty: { name: "Jinx" },
  } as unknown as CardTradeResponse;
}

const TRADES = [trade("t1"), trade("t2"), trade("t3")];
const resetActions = createStoreResetter(useTradeActionStore);

function renderBulk(trades = TRADES) {
  const client = new QueryClient({ defaultOptions: { mutations: { onError: () => {} } } });
  const view = render(
    <QueryClientProvider client={client}>
      <BulkTradeActions trades={trades} mode="accept-decline" />
    </QueryClientProvider>,
  );
  return {
    rerender: (next: CardTradeResponse[]) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <BulkTradeActions trades={next} mode="accept-decline" />
        </QueryClientProvider>,
      ),
  };
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
  acceptFn.mockClear();
  copyOptionsFn.mockClear();
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

  it("accepts only the trades whose copy choice does not matter and says how many wait", async () => {
    const { rerender } = renderBulk();
    await userEvent.setup().click(screen.getByRole("button", { name: /accept all/iu }));

    await waitFor(() => expect(useTradeActionStore.getState().pending.size).toBe(0));
    expect(acceptFn.mock.calls.map(([variables]) => variables.tradeId)).toEqual(["t1", "t3"]);
    expect(acceptFn.mock.calls.every(([variables]) => !("copyIds" in variables))).toBe(true);

    rerender([trade("t2")]);
    expect(
      screen.getByText("1 request needs you to pick which copy you give. Accept it on its row."),
    ).toBeInTheDocument();
    rerender([]);
    expect(screen.queryByText(/pick which cop/iu)).not.toBeInTheDocument();
  });

  it("leaves trades waiting for a copy choice out of the next accept-all", async () => {
    const user = userEvent.setup();
    const { rerender } = renderBulk();
    await user.click(screen.getByRole("button", { name: /accept all/iu }));
    await waitFor(() => expect(useTradeActionStore.getState().pending.size).toBe(0));
    acceptFn.mockClear();
    copyOptionsFn.mockClear();

    rerender([trade("t2"), trade("t4"), trade("t5")]);
    await user.click(screen.getByRole("button", { name: /accept all/iu }));

    await waitFor(() => expect(useTradeActionStore.getState().pending.size).toBe(0));
    expect(acceptFn.mock.calls.map(([variables]) => variables.tradeId)).toEqual(["t4", "t5"]);
    expect(copyOptionsFn).not.toHaveBeenCalledWith("t2");
  });

  it("counts only the trades accept-all can settle", async () => {
    const { rerender } = renderBulk();
    await userEvent.setup().click(screen.getByRole("button", { name: /accept all/iu }));
    await waitFor(() => expect(useTradeActionStore.getState().pending.size).toBe(0));

    rerender([trade("t2"), trade("t4"), trade("t5")]);

    expect(screen.getByRole("button", { name: /accept all/iu })).toHaveTextContent("2");
  });

  it("accepts the receiver's side without reading copy options", async () => {
    renderBulk([trade("t1", "receiver"), trade("t2", "receiver")]);
    await userEvent.setup().click(screen.getByRole("button", { name: /accept all/iu }));

    await waitFor(() => expect(acceptFn).toHaveBeenCalledTimes(2));
    expect(copyOptionsFn).not.toHaveBeenCalled();
  });
});
