import type {
  ListBulkAddResponse,
  ListDetailResponse,
  ListResponse,
} from "@openrift/shared/types/api/list";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/server-fns/orpc-client", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  apiOrpcClient: () => {
    throw new Error("list mutations must call the API from the browser");
  },
}));

vi.mock("@/hooks/use-session", () => ({
  useRequiredUserId: () => "test-user-id",
  useUserId: () => "test-user-id",
}));

vi.mock("@/lib/auth-session", () => ({
  // Read by the shared mutation error reporter on a 401; none of these tests
  // fail with one, but the module-level import has to resolve.
  sessionQueryOptions: () => ({ queryKey: ["session"] }),
}));

const { useTradeCancelConsentStore } =
  await import("@/features/groups/stores/trade-cancel-consent-store");
const { UserDeclinedError } = await import("@/lib/user-declined-error");
const {
  useBulkAddListEntries,
  useCreateList,
  useDeleteList,
  useRemoveListEntry,
  useReorderLists,
  useSetListSidebarHidden,
  useUpdateList,
  useUpdateListEntry,
} = await import("@/features/lists/hooks/use-lists");

function stubFetchJson(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(payload));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFetchNoContent() {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubFetchFailure() {
  const fetchMock = vi.fn().mockRejectedValue(new Error("Service unavailable"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  return { client, invalidateSpy };
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const LIST: ListResponse = {
  id: "lst-1",
  name: "Wants",
  intent: "wish",
  kind: "card",
  entryCount: 0,
  sidebarHidden: false,
  isPublic: false,
  shareToken: null,
  createdAt: "2026-05-17T00:00:00Z",
  updatedAt: "2026-05-17T00:00:00Z",
  tradeDefaults: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
  currency: null,
  hasRule: false,
};

const SECOND_LIST: ListResponse = { ...LIST, id: "lst-2", name: "Haves", intent: "trade" };

const DETAIL: ListDetailResponse = {
  list: { ...LIST, rules: [], ruleCombine: null },
  entries: [
    {
      kind: "card",
      id: "le-1",
      listId: "lst-1",
      cardId: "card-1",
      cardName: "Yasuo",
      quantity: 1,
      ruleQuantity: 0,
      source: "manual",
      tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCreateList", () => {
  it("invalidates both the un-filtered and intent-filtered list keys", async () => {
    stubFetchJson(LIST);
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useCreateList(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ name: "Wants", intent: "wish", kind: "card" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id", "intent", "wish"],
    });
  });
});

describe("useUpdateList", () => {
  it("invalidates both list and detail keys", async () => {
    stubFetchJson({ ...LIST, name: "Renamed" });
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useUpdateList(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-1", name: "Renamed" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id", "lst-1"],
    });
  });
});

describe("useSetListSidebarHidden", () => {
  it("moves the row behind Show more in the cache before the server answers", async () => {
    stubFetchJson({ ...LIST, sidebarHidden: true });
    const { client } = makeClient();
    const listsKey = ["lists", "test-user-id"];
    client.setQueryData(listsKey, { items: [LIST, SECOND_LIST] });
    const { result } = renderHook(() => useSetListSidebarHidden(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-1", hidden: true });
    });

    const cached = client.getQueryData(listsKey) as { items: ListResponse[] };
    expect(cached.items.map((list) => list.sidebarHidden)).toEqual([true, false]);
  });
});

describe("useDeleteList", () => {
  it("invalidates the list key on success", async () => {
    stubFetchNoContent();
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useDeleteList(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync("lst-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
  });
});

describe("useBulkAddListEntries", () => {
  it("forwards entries to the bulk endpoint and reports added/updated/skipped", async () => {
    const response: ListBulkAddResponse = { added: 2, updated: 1, skipped: 1 };
    stubFetchJson(response);
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useBulkAddListEntries(), { wrapper: wrap(client) });

    await act(async () => {
      const data = await result.current.mutateAsync({
        listId: "lst-1",
        entries: [{ copyId: "c1" }, { copyId: "c2" }, { copyId: "c3" }, { copyId: "c4" }],
      });
      expect(data).toEqual(response);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id", "lst-1"],
    });
  });
});

describe("useUpdateListEntry", () => {
  it("PATCHes the entry with the new quantity and invalidates both keys", async () => {
    const fetchMock = stubFetchJson({
      id: "le-1",
      listId: "lst-1",
      kind: "card",
      cardId: "card-1",
      quantity: 3,
      tradeOverride: { pricePref: null, priceAbsoluteCents: null, tradeType: null },
    });
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useUpdateListEntry(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-1", entryId: "le-1", quantity: 3 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // oRPC sends a body-bearing PATCH as a Request object (path params land in
    // the URL, the rest in the JSON body).
    const [first] = fetchMock.mock.calls[0] as [
      Request | string,
      { method: string; body: string }?,
    ];
    const request = first instanceof Request ? first : null;
    expect(request).not.toBeNull();
    expect(request!.url).toBe("http://localhost:3000/api/v1/lists/lst-1/entries/le-1");
    expect(request!.method).toBe("PATCH");
    expect(await request!.json()).toEqual({ quantity: 3 });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id", "lst-1"],
    });
  });
});

// react-query merges mutation options shallowly, so a hook's own onError replaces
// the QueryClient's default one; each rollback below must report the failure itself.
describe("optimistic rollbacks still report the failure", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function makeAppClient() {
    return createQueryClient();
  }

  it("useReorderLists restores the previous order and toasts", async () => {
    stubFetchFailure();
    const client = makeAppClient();
    const listsKey = ["lists", "test-user-id"];
    client.setQueryData(listsKey, { items: [LIST, SECOND_LIST] });
    const { result } = renderHook(() => useReorderLists(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current
        .mutateAsync({ intent: "wish", orderedIds: ["lst-2", "lst-1"] })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(listsKey)).toEqual({ items: [LIST, SECOND_LIST] });
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
  });

  it("useSetListSidebarHidden restores the previous visibility and toasts", async () => {
    stubFetchFailure();
    const client = makeAppClient();
    const listsKey = ["lists", "test-user-id"];
    client.setQueryData(listsKey, { items: [LIST, SECOND_LIST] });
    const { result } = renderHook(() => useSetListSidebarHidden(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-1", hidden: true }).catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(listsKey)).toEqual({ items: [LIST, SECOND_LIST] });
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
  });

  it("useBulkAddListEntries restores the previous quantities and toasts", async () => {
    stubFetchFailure();
    const client = makeAppClient();
    const detailKey = ["lists", "test-user-id", "lst-1"];
    client.setQueryData(detailKey, DETAIL);
    const { result } = renderHook(() => useBulkAddListEntries(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current
        .mutateAsync({ listId: "lst-1", entries: [{ cardId: "card-1", quantity: 2 }] })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<ListDetailResponse>(detailKey)?.entries[0]!.quantity).toBe(1);
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
  });

  it("toasts the API's own message and keeps its status for the shared reporter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            defined: true,
            code: "BAD_REQUEST",
            status: 400,
            message: "Quantity must be positive",
          },
          { status: 400 },
        ),
      ),
    );
    const client = makeAppClient();
    const { result } = renderHook(() => useUpdateListEntry(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current
        .mutateAsync({ listId: "lst-1", entryId: "le-1", quantity: 7 })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 400, code: "BAD_REQUEST" });
    expect(toast.error).toHaveBeenCalledWith("Quantity must be positive", PERSISTENT_ERROR_TOAST);
  });

  it("useUpdateListEntry restores the previous entry and toasts", async () => {
    stubFetchFailure();
    const client = makeAppClient();
    const detailKey = ["lists", "test-user-id", "lst-1"];
    client.setQueryData(detailKey, DETAIL);
    const { result } = renderHook(() => useUpdateListEntry(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current
        .mutateAsync({ listId: "lst-1", entryId: "le-1", quantity: 7 })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<ListDetailResponse>(detailKey)?.entries[0]!.quantity).toBe(1);
    expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
  });
});

describe("edits that would cancel pending trades", () => {
  const TRADE = {
    id: "e0000000-0001-4000-a000-000000000001",
    cardId: "card-1",
    printingId: "printing-1",
    quantity: 1,
    counterpartyName: "Mara",
  };

  function conflictResponse() {
    return Response.json(
      {
        defined: true,
        code: "CONFLICT",
        status: 409,
        message: "This change would cancel pending trades. Confirm to cancel them.",
        data: { trades: [TRADE] },
      },
      { status: 409 },
    );
  }

  async function bodyOf(call: unknown[]): Promise<unknown> {
    const text = await (call[0] as Request).text();
    return text === "" ? undefined : JSON.parse(text);
  }

  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    useTradeCancelConsentStore.setState({ request: null });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("goes straight through without asking when the server cancels nothing", async () => {
    const fetchMock = stubFetchNoContent();
    const { client } = makeClient();
    const { result } = renderHook(() => useRemoveListEntry(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-2", entryId: "le-1" });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useTradeCancelConsentStore.getState().request).toBeNull();
  });

  it("asks with the trades the server named, then retries with their ids", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(conflictResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useDeleteList(), { wrapper: wrap(client) });

    let pending: Promise<unknown> = Promise.resolve();
    act(() => {
      pending = result.current.mutateAsync("lst-2");
    });
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    expect(useTradeCancelConsentStore.getState().request?.trades).toEqual([TRADE]);
    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => {
      useTradeCancelConsentStore.getState().answer(true);
      await pending;
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await bodyOf(fetchMock.mock.calls[1]!)).toEqual({ cancelTradeIds: [TRADE.id] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["lists", "test-user-id"] });
  });

  it("declining sends nothing more, keeps the cache and stays quiet", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(conflictResponse());
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const listsKey = ["lists", "test-user-id"];
    client.setQueryData(listsKey, { items: [LIST, SECOND_LIST] });
    const { result } = renderHook(() => useDeleteList(), { wrapper: wrap(client) });

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.mutateAsync("lst-2").catch((error: unknown) => error);
    });
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    await act(async () => {
      useTradeCancelConsentStore.getState().answer(false);
      await outcome;
    });

    expect(await outcome).toBeInstanceOf(UserDeclinedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(listsKey)).toEqual({ items: [LIST, SECOND_LIST] });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("declining rolls an optimistic change back without a toast", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(conflictResponse()));
    const client = createQueryClient();
    const listsKey = ["lists", "test-user-id"];
    client.setQueryData(listsKey, { items: [LIST, SECOND_LIST] });
    const { result } = renderHook(() => useSetListSidebarHidden(), { wrapper: wrap(client) });

    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = result.current.mutateAsync({ listId: "lst-2", hidden: true }).catch(() => {});
    });
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    const hiddenWhileAsking = client
      .getQueryData<{ items: ListResponse[] }>(listsKey)
      ?.items.find((list) => list.id === "lst-2")?.sidebarHidden;
    expect(hiddenWhileAsking).toBe(true);

    await act(async () => {
      useTradeCancelConsentStore.getState().answer(false);
      await outcome;
    });

    expect(client.getQueryData(listsKey)).toEqual({ items: [LIST, SECOND_LIST] });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("useRemoveListEntry", () => {
  it("invalidates list and detail on success", async () => {
    stubFetchNoContent();
    const { client, invalidateSpy } = makeClient();
    const { result } = renderHook(() => useRemoveListEntry(), { wrapper: wrap(client) });

    await act(async () => {
      await result.current.mutateAsync({ listId: "lst-1", entryId: "le-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["lists", "test-user-id", "lst-1"],
    });
  });
});
