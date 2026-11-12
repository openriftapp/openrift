import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => ({}),
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

vi.mock("@/lib/server-fns/middleware", () => ({
  withCookies: () => {},
}));

const { useClearPrices } = await import("./use-admin-prices");

describe("useClearPrices", () => {
  it("refetches the marketplace group counts after clearing", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useClearPrices("tcgplayer"), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    const keys = vi
      .mocked(client.invalidateQueries)
      .mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey);
    expect(keys).toContainEqual(["admin", "marketplace-groups"]);
    expect(keys).toContainEqual(["admin", "tcgplayer"]);
  });
});
