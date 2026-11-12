import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (input: Record<string, unknown>) => unknown) => (input?: Record<string, unknown>) =>
          fn({ context: { cookie: "" }, ...input }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
  createMiddleware: () => {
    const chain = {
      server: () => chain,
      client: () => chain,
    };
    return chain;
  },
}));

const list = vi.fn();

vi.mock("@/lib/server-fns/orpc-client", () => ({
  apiOrpcClient: () => ({ list }),
}));

const { useCardBans } = await import("./use-card-bans");

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useCardBans", () => {
  beforeEach(() => {
    list.mockReset();
    list.mockResolvedValue({ bans: [] });
  });

  it("waits for the card id before asking for its bans", async () => {
    const { result, rerender } = renderHook(({ cardId }) => useCardBans(cardId), {
      initialProps: { cardId: "" },
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(list).not.toHaveBeenCalled();

    rerender({ cardId: "019d6c25-b081-74b3-a901-64da4ae01dab" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(list).toHaveBeenCalledWith({ id: "019d6c25-b081-74b3-a901-64da4ae01dab" });
  });
});
