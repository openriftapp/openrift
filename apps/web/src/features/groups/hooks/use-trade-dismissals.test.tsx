import type { TradeSuggestionDismissal } from "@openrift/shared/types/api/card-trade";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { tradesKeys } from "@/features/groups/lib/groups-query-keys";

const serverFn = vi.hoisted(() => vi.fn());
const reportMutationError = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const chain = {
    validator: () => chain,
    middleware: () => chain,
    handler: () => serverFn,
  };
  return { ...(await importOriginal<Record<string, unknown>>()), createServerFn: () => chain };
});
vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/server-fns/orpc-client", () => ({ apiOrpcClient: () => ({}) }));
vi.mock("@/lib/auth-session", () => ({ useRequiredUserId: () => "user-1" }));
vi.mock("@/lib/query-client", () => ({ reportMutationError }));

const { useDismissSuggestions, useRestoreSuggestion } = await import("./use-trade-dismissals");

const ROBOGIRL: TradeSuggestionDismissal = {
  direction: "outgoing",
  counterpartyUserId: "user-robogirl",
  printingId: "printing-1",
};
const KEY = tradesKeys.dismissals("user-1");

function setup(items: TradeSuggestionDismissal[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(KEY, { items });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe("useDismissSuggestions", () => {
  it("hides the suggestion right away and sends it", async () => {
    serverFn.mockResolvedValueOnce(undefined);
    const { queryClient, wrapper } = setup([]);
    const { result } = renderHook(() => useDismissSuggestions(), { wrapper });
    act(() => {
      result.current.mutate([ROBOGIRL]);
    });
    await waitFor(() => expect(serverFn).toHaveBeenCalledWith({ data: [ROBOGIRL] }));
    expect(queryClient.getQueryData(KEY)).toEqual({ items: [ROBOGIRL] });
  });

  it("puts the list back and reports when sending fails", async () => {
    serverFn.mockRejectedValueOnce(new Error("offline"));
    const { queryClient, wrapper } = setup([]);
    const { result } = renderHook(() => useDismissSuggestions(), { wrapper });
    act(() => {
      result.current.mutate([ROBOGIRL]);
    });
    await waitFor(() => expect(reportMutationError).toHaveBeenCalled());
    expect(queryClient.getQueryData(KEY)).toEqual({ items: [] });
  });
});

describe("useRestoreSuggestion", () => {
  it("shows the suggestion again right away", async () => {
    serverFn.mockResolvedValueOnce(undefined);
    const { queryClient, wrapper } = setup([ROBOGIRL]);
    const { result } = renderHook(() => useRestoreSuggestion(), { wrapper });
    act(() => {
      result.current.mutate(ROBOGIRL);
    });
    await waitFor(() => expect(serverFn).toHaveBeenCalledWith({ data: ROBOGIRL }));
    expect(queryClient.getQueryData(KEY)).toEqual({ items: [] });
  });
});
