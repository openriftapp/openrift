import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async () => {},
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

const {
  useDeletePrintingLink,
  useIgnoreCandidateCard,
  useIgnoreCandidatePrinting,
  useUnignoreCandidateCard,
  useUnignoreCandidatePrinting,
} = await import("./use-ignored-candidates");

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

const printingInput = { provider: "tcgplayer", externalId: "123", finish: "foil" };
const cardInput = { provider: "tcgplayer", externalId: "123" };

describe.each([
  ["useIgnoreCandidateCard", () => useIgnoreCandidateCard(), cardInput],
  ["useUnignoreCandidateCard", () => useUnignoreCandidateCard(), cardInput],
  ["useIgnoreCandidatePrinting", () => useIgnoreCandidatePrinting(), printingInput],
  ["useUnignoreCandidatePrinting", () => useUnignoreCandidatePrinting(), printingInput],
  ["useDeletePrintingLink", () => useDeletePrintingLink(), printingInput],
] as const)("%s", (_name, useHook, input) => {
  it("refetches the review queue so the sidebar count updates", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useHook(), { wrapper: wrap(client) });

    await act(async () => {
      await (result.current.mutateAsync as (params: typeof input) => Promise<unknown>)(input);
    });

    expect(invalidatedKeys(client)).toContainEqual(["admin", "review-queue"]);
    expect(invalidatedKeys(client)).toContainEqual(["admin", "cards"]);
  });
});
