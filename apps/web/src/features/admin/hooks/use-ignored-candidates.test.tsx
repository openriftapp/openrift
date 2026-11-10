import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  calls: [] as unknown[],
  failOn: null as string | null,
  drafts: new Map<string, { sources: { provider: string; externalId: string }[] }>(),
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => async (args?: { data?: { externalId?: string } }) => {
        server.calls.push(args?.data);
        if (server.failOn !== null && args?.data?.externalId === server.failOn) {
          throw new Error("refused");
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

vi.mock("@/lib/server-fns/middleware", () => ({
  withCookies: () => {},
}));

vi.mock("@/features/admin/lib/admin-card-queries", () => ({
  unmatchedCardDetailQueryOptions: (name: string) => ({
    queryKey: ["admin", "cards", "unmatched", name],
    queryFn: () => server.drafts.get(name),
  }),
}));

const {
  useDeletePrintingLink,
  useIgnoreCandidateCard,
  useIgnoreCandidatePrinting,
  useIgnoreNewCardDrafts,
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

describe("useIgnoreNewCardDrafts", () => {
  beforeEach(() => {
    server.calls.length = 0;
    server.failOn = null;
    server.drafts.clear();
    server.drafts.set("jinx", {
      sources: [
        { provider: "provider-a", externalId: "a1" },
        { provider: "usersubmission", externalId: "u1" },
      ],
    });
    server.drafts.set("vi", { sources: [{ provider: "provider-b", externalId: "b1" }] });
    server.drafts.set("ekko", { sources: [{ provider: "usersubmission", externalId: "u2" }] });
  });

  it("ignores only provider sources, counts drafts that had one, and refreshes once", async () => {
    const client = makeClient();
    const { result } = renderHook(() => useIgnoreNewCardDrafts([["admin", "workspace"]]), {
      wrapper: wrap(client),
    });

    let outcome: { ignored: number; sources: unknown[] } | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync(["jinx", "vi", "ekko"]);
    });

    expect(outcome).toEqual({
      ignored: 2,
      sources: [
        { provider: "provider-a", externalId: "a1" },
        { provider: "provider-b", externalId: "b1" },
      ],
    });
    expect(server.calls).toEqual([
      { provider: "provider-a", externalId: "a1" },
      { provider: "provider-b", externalId: "b1" },
    ]);
    const keys = invalidatedKeys(client);
    expect(keys.filter((key) => key.join("/") === "admin/workspace")).toHaveLength(1);
    expect(keys).toContainEqual(["admin", "review-queue"]);
  });

  it("stops at the first refused source and still refreshes", async () => {
    server.failOn = "a1";
    const client = makeClient();
    const { result } = renderHook(() => useIgnoreNewCardDrafts([["admin", "workspace"]]), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(["jinx", "vi"])).rejects.toThrow("refused");
    });

    expect(server.calls).toEqual([{ provider: "provider-a", externalId: "a1" }]);
    expect(invalidatedKeys(client)).toContainEqual(["admin", "workspace"]);
  });
});
