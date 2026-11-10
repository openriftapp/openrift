import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => () => {
        throw new Error("unsharing a list must call the API from the browser");
      },
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = { server: () => chain };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));

vi.mock("@/hooks/use-session", () => ({
  useRequiredUserId: () => "test-user-id",
  useUserId: () => "test-user-id",
}));

const { useTradeCancelConsentStore } =
  await import("@/features/groups/stores/trade-cancel-consent-store");
const { useUnshareListFromFriendGroup } =
  await import("@/features/groups/hooks/use-friend-group-sharing");

const TRADE = {
  id: "e0000000-0001-4000-a000-000000000001",
  cardId: "card-1",
  printingId: "printing-1",
  quantity: 1,
  counterpartyName: "Mara",
};

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUnshareListFromFriendGroup", () => {
  it("asks before an unshare cancels trades and retries with the confirmed ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          {
            defined: true,
            code: "CONFLICT",
            status: 409,
            message: "This change would cancel pending trades. Confirm to cancel them.",
            data: { trades: [TRADE] },
          },
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();
    const { result } = renderHook(() => useUnshareListFromFriendGroup(), {
      wrapper: wrap(client),
    });

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.mutateAsync({ slug: "playgroup", listId: "lst-1" });
    });
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    await act(async () => {
      useTradeCancelConsentStore.getState().answer(true);
      await pending;
    });

    const request = fetchMock.mock.calls[1]![0] as Request;
    expect(request.method).toBe("DELETE");
    expect(request.url).toBe("http://localhost:3000/api/v1/friend-groups/playgroup/lists/lst-1");
    expect(await request.json()).toEqual({ cancelTradeIds: [TRADE.id] });
  });
});
