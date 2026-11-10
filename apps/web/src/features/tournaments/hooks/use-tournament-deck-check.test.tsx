import type { DeckCheckEntryDetailResponse } from "@openrift/shared/types/api/deck-check";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tournamentDeckCheckKeys } from "@/features/tournaments/lib/tournaments-query-keys";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (args: { context: { cookie: string }; data: unknown }) => unknown) =>
        (args?: { data?: unknown }) =>
          fn({ context: { cookie: "" }, data: args?.data }),
      middleware: () => chain,
      validator: () => chain,
    };
    return chain;
  },
}));

vi.mock("@/lib/server-fns/middleware", () => ({ withCookies: () => {} }));

vi.mock("@/hooks/use-session", () => ({
  useRequiredUserId: () => "user-1",
}));

const tickCard = vi.fn<(input: unknown) => Promise<void>>();
vi.mock("@/lib/server-fns/orpc-client", () => ({
  apiOrpcClient: () => ({ tickCard }),
}));

const reportMutationError = vi.fn();
vi.mock("@/lib/query-client", () => ({
  reportMutationError: (...args: unknown[]) => reportMutationError(...args),
}));

const { useTickTournamentDeckCheckCard } = await import("./use-tournament-deck-check");

const ENTRY_KEY = tournamentDeckCheckKeys.entry("user-1", "t-1", "e-1");

function makeDetail(foundCopies: boolean[]): DeckCheckEntryDetailResponse {
  return {
    cards: [{ id: "card-1", foundCopies }],
  } as unknown as DeckCheckEntryDetailResponse;
}

function readFoundCopies(client: QueryClient): boolean[] | undefined {
  return client.getQueryData<DeckCheckEntryDetailResponse>(ENTRY_KEY)?.cards[0]?.foundCopies;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(ENTRY_KEY, makeDetail([false, false]));
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result } = renderHook(() => useTickTournamentDeckCheckCard(), { wrapper: Wrapper });
  return { client, invalidateSpy, result };
}

function deferred() {
  let settle: () => void = () => {};
  let fail: (error: unknown) => void = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, resolve: settle, reject: fail };
}

const vars = (copyIndex: number, found = true) => ({
  tournamentId: "t-1",
  entryId: "e-1",
  cardId: "card-1",
  copyIndex,
  found,
});

afterEach(() => {
  tickCard.mockReset();
  reportMutationError.mockReset();
});

describe("useTickTournamentDeckCheckCard", () => {
  it("shows the tick before the server answers", async () => {
    const request = deferred();
    tickCard.mockReturnValue(request.promise);
    const { client, result } = setup();

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.mutateAsync(vars(1));
      await Promise.resolve();
    });

    expect(readFoundCopies(client)).toEqual([false, true]);
    request.resolve();
    await act(() => pending);
  });

  it("rolls the tick back and reports a failed request", async () => {
    tickCard.mockRejectedValue(new Error("Network down"));
    const { client, result } = setup();

    await act(async () => {
      await result.current.mutateAsync(vars(0)).catch(() => {});
    });

    expect(readFoundCopies(client)).toEqual([false, false]);
    expect(reportMutationError).toHaveBeenCalledTimes(1);
  });

  it("resolves as stale on the typed conflict without reporting an error", async () => {
    tickCard.mockRejectedValue(new ORPCError("CONFLICT", { defined: true }));
    const { result } = setup();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync(vars(0));
    });

    expect(outcome).toEqual({ status: "stale" });
    expect(reportMutationError).not.toHaveBeenCalled();
  });

  it("refetches the entry only after the last of several quick ticks settles", async () => {
    const first = deferred();
    const second = deferred();
    tickCard.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { client, invalidateSpy, result } = setup();

    let firstDone: Promise<unknown> = Promise.resolve();
    let secondDone: Promise<unknown> = Promise.resolve();
    await act(async () => {
      firstDone = result.current.mutateAsync(vars(0));
      secondDone = result.current.mutateAsync(vars(1));
      await Promise.resolve();
    });

    first.resolve();
    await act(() => firstDone);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(readFoundCopies(client)).toEqual([true, true]);

    second.resolve();
    await act(() => secondDone);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ENTRY_KEY });
  });
});
