import type { ListEntryDetailResponse } from "@openrift/shared/types/api/list";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-session", () => ({
  useRequiredUserId: () => "test-user-id",
  useUserId: () => "test-user-id",
}));

vi.mock("@/lib/auth-session", () => ({ sessionQueryOptions: () => ({ queryKey: ["session"] }) }));

const { useBulkAddListEntries, useRemoveListEntry, useUpdateListEntry } =
  await import("@/features/lists/hooks/use-lists");
const { useListEntryWritesPending } =
  await import("@/features/lists/hooks/use-list-entry-writes-pending");

function cardEntry(id: string, cardId: string): ListEntryDetailResponse {
  return {
    kind: "card",
    id,
    listId: "lst-1",
    cardId,
    cardName: cardId,
    quantity: 2,
    ruleQuantity: 0,
    source: "manual",
    tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
  } as ListEntryDetailResponse;
}

const ENTRIES = [cardEntry("le-1", "card-1"), cardEntry("le-2", "card-2")];

function renderWrites() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return renderHook(
    () => ({
      add: useBulkAddListEntries(),
      update: useUpdateListEntry(),
      remove: useRemoveListEntry(),
      pending: useListEntryWritesPending("lst-1", ENTRIES),
    }),
    { wrapper: Wrapper },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useListEntryWritesPending", () => {
  it("counts an add that bumps the entry, keyed by card", async () => {
    const { result } = renderWrites();

    act(() => result.current.add.mutate({ listId: "lst-1", entries: [{ cardId: "card-1" }] }));

    await waitFor(() => expect(result.current.pending("le-1")).toBe(true));
    expect(result.current.pending("le-2")).toBe(false);
  });

  it("keeps an earlier row's add pending after another row starts a write", async () => {
    const { result } = renderWrites();

    act(() => result.current.add.mutate({ listId: "lst-1", entries: [{ cardId: "card-1" }] }));
    act(() => result.current.add.mutate({ listId: "lst-1", entries: [{ cardId: "card-2" }] }));

    await waitFor(() => expect(result.current.pending("le-2")).toBe(true));
    expect(result.current.pending("le-1")).toBe(true);
  });

  it("counts an absolute update and a remove of the entry", async () => {
    const { result } = renderWrites();

    act(() => result.current.update.mutate({ listId: "lst-1", entryId: "le-1", quantity: 1 }));
    act(() => result.current.remove.mutate({ listId: "lst-1", entryId: "le-2" }));

    await waitFor(() => expect(result.current.pending("le-1")).toBe(true));
    expect(result.current.pending("le-2")).toBe(true);
  });
});
