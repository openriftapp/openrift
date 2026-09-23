import type { CardTradeLiveAnnotation } from "@openrift/shared/types/api/card-trade";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aggregateIncomingTradeCounts, useCreateTrade } from "./use-card-trades";

const { serverFnCall, captureHandledError } = vi.hoisted(() => ({
  serverFnCall: vi.fn<() => Promise<unknown>>(),
  captureHandledError: vi.fn(),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => serverFnCall,
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/auth-session", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRequiredUserId: () => "user-1",
}));
vi.mock("@/lib/report-error", () => ({ captureHandledError }));
vi.mock("@/lib/toast", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  toastError: vi.fn(),
}));

function annotation(overrides: Partial<CardTradeLiveAnnotation> = {}): CardTradeLiveAnnotation {
  return {
    printingId: "printing-1",
    role: "receiver",
    phase: "reserved",
    tradeCount: 1,
    quantity: 1,
    ...overrides,
  };
}

describe("aggregateIncomingTradeCounts", () => {
  it("returns an empty map for no annotations", () => {
    expect(aggregateIncomingTradeCounts([])).toEqual({});
  });

  it("counts reserved trades where the viewer receives", () => {
    expect(aggregateIncomingTradeCounts([annotation({ quantity: 2 })])).toEqual({
      "printing-1": 2,
    });
  });

  it("sums several reserved trades on one printing into one incoming count", () => {
    const counts = aggregateIncomingTradeCounts([
      annotation({ quantity: 1 }),
      annotation({ quantity: 3 }),
    ]);

    expect(counts).toEqual({ "printing-1": 4 });
  });

  it("ignores the giver side, already tracked as lockedReserved on the copies", () => {
    expect(aggregateIncomingTradeCounts([annotation({ role: "giver", quantity: 2 })])).toEqual({});
  });

  it("ignores phases before reserve, since nothing is pinned yet", () => {
    expect(
      aggregateIncomingTradeCounts([
        annotation({ phase: "asked", quantity: 2 }),
        annotation({ phase: "offered", quantity: 5 }),
      ]),
    ).toEqual({});
  });

  it("keeps printings apart and drops the phases it does not count", () => {
    const counts = aggregateIncomingTradeCounts([
      annotation({ printingId: "a", quantity: 2 }),
      annotation({ printingId: "b", quantity: 1 }),
      annotation({ printingId: "b", phase: "offered", quantity: 9 }),
      annotation({ printingId: "c", role: "giver", quantity: 4 }),
    ]);

    expect(counts).toEqual({ a: 2, b: 1 });
  });
});

describe("useCreateTrade", () => {
  const variables = {
    groupSlug: "summoner-skirmish",
    counterpartyUserId: "user-2",
    role: "receiver" as const,
    printingId: "printing-1",
    quantity: 1,
  };

  function renderCreateTrade() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useCreateTrade(), { wrapper });
    const invalidatedKeys = () => invalidate.mock.calls.map((call) => call[0]?.queryKey);
    return { result, invalidatedKeys };
  }

  beforeEach(() => {
    serverFnCall.mockReset();
    captureHandledError.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("refetches the group and trades without reporting a conflict", async () => {
    serverFnCall.mockRejectedValue(
      Object.assign(new Error("That card is no longer available to trade"), { status: 409 }),
    );
    const { result, invalidatedKeys } = renderCreateTrade();

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => {});
    });

    expect(invalidatedKeys()).toContainEqual(["friend-groups", "user-1", "summoner-skirmish"]);
    expect(invalidatedKeys()).toContainEqual(["trades", "user-1"]);
    expect(captureHandledError).not.toHaveBeenCalled();
  });

  it("reports a server failure and leaves the queries alone", async () => {
    serverFnCall.mockRejectedValue(Object.assign(new Error("Boom"), { status: 500 }));
    const { result, invalidatedKeys } = renderCreateTrade();

    await act(async () => {
      await result.current.mutateAsync(variables).catch(() => {});
    });

    expect(invalidatedKeys()).toEqual([]);
    expect(captureHandledError).toHaveBeenCalledOnce();
  });
});
