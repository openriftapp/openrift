import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      handler: () => async () => ({ cardSlug: "OGN-042", printingsCreated: 1 }),
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

const { settleKeys, useAcceptSubmission, useCreateCardFromCandidate, useRejectSubmission } =
  await import("./use-catalog-review");

const CANDIDATE = "019cfc3b-0388-743b-8b2e-7e64f56850c3";

function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.spyOn(client, "invalidateQueries");
  return { client };
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function invalidatedKeys(client: QueryClient): unknown[][] {
  const spy = vi.mocked(client.invalidateQueries);
  return spy.mock.calls.map(
    (call) => (call[0] as { queryKey: unknown[] } | undefined)?.queryKey ?? [],
  );
}

describe("settleKeys", () => {
  it("always refetches the queue, the candidate's submission and the card list", () => {
    expect(settleKeys(CANDIDATE)).toEqual([
      ["admin", "catalog", "review-queue"],
      ["card-submissions", "candidate", CANDIDATE],
      ["admin", "cards", "list"],
    ]);
  });

  it("adds the card detail key when the settle happened on a card page", () => {
    expect(settleKeys(CANDIDATE, { cardSlug: "OGN-001" })).toContainEqual([
      "admin",
      "cards",
      "detail",
      "OGN-001",
    ]);
  });

  it("adds the unmatched key when the settle happened on a draft page", () => {
    expect(settleKeys(CANDIDATE, { draftName: "lux-lady-of-luminosity" })).toContainEqual([
      "admin",
      "cards",
      "unmatched",
      "lux-lady-of-luminosity",
    ]);
  });
});

describe("useAcceptSubmission", () => {
  it("invalidates the settle keys for its scope", async () => {
    const { client } = makeClient();
    const { result } = renderHook(() => useAcceptSubmission({ cardSlug: "OGN-001" }), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ candidateCardId: CANDIDATE });
    });

    expect(invalidatedKeys(client)).toEqual(settleKeys(CANDIDATE, { cardSlug: "OGN-001" }));
  });
});

describe("useRejectSubmission", () => {
  it("invalidates the unmatched key when rejecting from a draft", async () => {
    const { client } = makeClient();
    const { result } = renderHook(() => useRejectSubmission({ draftName: "jinx-loose-cannon" }), {
      wrapper: wrap(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        candidateCardId: CANDIDATE,
        reason: "unverified",
        note: null,
      });
    });

    expect(invalidatedKeys(client)).toContainEqual([
      "admin",
      "cards",
      "unmatched",
      "jinx-loose-cannon",
    ]);
  });
});

describe("useCreateCardFromCandidate", () => {
  it("invalidates the created card's detail and the all-cards list", async () => {
    const { client } = makeClient();
    const { result } = renderHook(
      () => useCreateCardFromCandidate({ draftName: "jinx-loose-cannon" }),
      { wrapper: wrap(client) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        candidateCardId: CANDIDATE,
        cardFields: { id: "OGN-042", name: "Jinx", types: ["unit"], domains: ["chaos"] },
      });
    });

    const keys = invalidatedKeys(client);
    expect(keys).toContainEqual(["admin", "cards", "detail", "OGN-042"]);
    expect(keys).toContainEqual(["admin", "cards", "unmatched", "jinx-loose-cannon"]);
    expect(keys).toContainEqual(["admin", "cards", "all-cards"]);
  });
});
