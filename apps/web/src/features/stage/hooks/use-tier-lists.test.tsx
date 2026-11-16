import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { serverCall } = vi.hoisted(() => ({ serverCall: vi.fn() }));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => ({
    validator: () => ({ middleware: () => ({ handler: () => serverCall }) }),
    middleware: () => ({ handler: () => serverCall }),
  }),
}));
vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));
vi.mock("@/lib/server-fns/orpc-client", () => ({ apiOrpcClient: () => ({}) }));
vi.mock("@/hooks/use-session", () => ({ useRequiredUserId: () => "user-1" }));

const { useUpdateTierList } = await import("./use-tier-lists");

function deferred() {
  let land: (value: unknown) => void = () => {};
  const promise = new Promise((resolve) => {
    land = resolve;
  });
  return { promise, resolve: land };
}

describe("useUpdateTierList", () => {
  it("sends a newer save only after the one before it has landed", async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const first = deferred();
    serverCall.mockReturnValueOnce(first.promise).mockResolvedValueOnce({});
    const { result } = renderHook(() => useUpdateTierList(), { wrapper });

    act(() => result.current.mutate({ id: "list-1", tiers: [] }));
    act(() => result.current.mutate({ id: "list-1", tiers: [{ label: "S", cards: [] }] }));
    await act(() => Promise.resolve());

    expect(serverCall).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve({});
      await first.promise;
    });
    await vi.waitFor(() => expect(serverCall).toHaveBeenCalledTimes(2));
    expect(serverCall).toHaveBeenLastCalledWith({
      data: { id: "list-1", tiers: [{ label: "S", cards: [] }] },
    });
  });
});
