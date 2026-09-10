import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ calls: [] as { field: string; source: string }[], failAt: -1 }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      handler: () => async (input: { data: { field: string; source: string } }) => {
        state.calls.push(input.data);
        if (state.calls.length - 1 === state.failAt) {
          throw new Error("Write refused");
        }
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

const { useSaveCardFields } = await import("./use-save-card-fields");

const CARD_ID = "019cfc3b-0388-743b-8b2e-7e64f56850c3";

const CHANGES = [
  { field: "name" as const, value: "Lux, Lady of Luminosity" },
  { field: "energy" as const, value: 4 },
  { field: "domains" as const, value: ["calm"] },
];

function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(client, "invalidateQueries");
  return client;
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function invalidatedKeys(client: QueryClient): unknown[][] {
  return vi
    .mocked(client.invalidateQueries)
    .mock.calls.map((call) => (call[0] as { queryKey: unknown[] } | undefined)?.queryKey ?? []);
}

beforeEach(() => {
  state.calls = [];
  state.failAt = -1;
});

describe("useSaveCardFields", () => {
  it("writes every change in order as a manual edit", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSaveCardFields("OGN-001"), { wrapper: wrap(client) });

    let saved = false;
    await act(async () => {
      saved = await result.current.run(CARD_ID, CHANGES);
    });

    expect(saved).toBe(true);
    expect(state.calls.map((call) => call.field)).toEqual(["name", "energy", "domains"]);
    expect(state.calls.every((call) => call.source === "manual")).toBe(true);
  });

  it("stops at the first refused write and reports the failure", async () => {
    state.failAt = 1;
    const client = makeClient();
    const { result } = renderHook(() => useSaveCardFields("OGN-001"), { wrapper: wrap(client) });

    let saved = true;
    await act(async () => {
      saved = await result.current.run(CARD_ID, CHANGES);
    });

    expect(saved).toBe(false);
    expect(state.calls.map((call) => call.field)).toEqual(["name", "energy"]);
  });

  it("refetches the card once for the whole batch", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useSaveCardFields("OGN-001"), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.run(CARD_ID, CHANGES);
    });

    expect(invalidatedKeys(client)).toEqual([
      ["admin", "cards", "detail", "OGN-001"],
      ["admin", "cards", "list"],
      ["admin", "catalog", "review-queue"],
    ]);
  });

  it("still refetches after a refused write, because earlier fields landed", async () => {
    state.failAt = 0;
    const client = makeClient();
    const { result } = renderHook(() => useSaveCardFields("OGN-001"), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.run(CARD_ID, CHANGES);
    });

    expect(invalidatedKeys(client)).toHaveLength(3);
  });
});
