import type { CardTradeLiveAnnotation } from "@openrift/shared/types/api/card-trade";
import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { collectionsKeys } from "@/features/collections/lib/collections-query-keys";
import { tradesKeys } from "@/features/groups/lib/groups-query-keys";
import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";
import { UserDeclinedError } from "@/lib/user-declined-error";
import { stubCopy } from "@/test/factories";

const fetchCopies = vi.hoisted(() => vi.fn());
vi.mock("@/features/collections/lib/copies-query", () => ({ fetchCopies }));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      // oxlint-disable-next-line react/function-component-definition -- mocked server-fn handler, not a component
      handler: () => async () => null,
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

vi.mock("@/lib/server-fns/fetch-api", () => ({
  fetchApi: vi.fn(),
  fetchApiJson: vi.fn(),
}));

vi.mock("@/lib/server-fns/middleware", () => ({
  withCookies: () => {},
}));

const { getCopiesCollection } = await import("@/features/collections/lib/copies-collection");
const { useAddCopies, useBatchedAddCopies, useDisposeCopies, useMoveCopies, useUpdateCopies } =
  await import("./use-copies");

const USER = "user-1";
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface SentRequest {
  path: string;
  body: unknown;
}

let sent: SentRequest[];
let respond: (request: SentRequest) => Response;

function succeed(request: SentRequest): Response {
  if (request.path !== "/api/v1/copies") {
    return new Response(null, { status: 204 });
  }
  const { copies } = request.body as { copies: Partial<CopyResponse>[] };
  return Response.json({ items: copies.map((copy) => stubCopy(copy)) }, { status: 201 });
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function seedSession(client: QueryClient) {
  client.setQueryData(["session"], {
    session: { id: "s", userId: USER, expiresAt: "", token: "" },
    user: {
      id: USER,
      name: "Test",
      email: "test@example.test",
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
    },
  });
}

function seedCollections(
  client: QueryClient,
  collections: { id: string; groupId: string | null }[],
) {
  client.setQueryData(
    collectionsKeys.syncedStore(USER),
    collections.map(({ id, groupId }) => ({ id, groupId })),
  );
}

async function signedInWithCopies(
  rows: CopyResponse[],
  annotations: CardTradeLiveAnnotation[] = [],
) {
  const client = newClient();
  seedSession(client);
  client.setQueryData(tradesKeys.liveByPrinting(USER), { annotations });
  fetchCopies.mockResolvedValue({ items: rows, nextCursor: null });
  const collection = getCopiesCollection(client, USER);
  await collection.preload();
  return { client, collection };
}

beforeEach(() => {
  sent = [];
  respond = succeed;
  fetchCopies.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const request = {
        path: new URL(input.url).pathname,
        body: input.method === "GET" ? undefined : await input.clone().json(),
      };
      sent.push(request);
      return respond(request);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copies mutation hooks tolerate an unauthenticated session at mount", () => {
  it("useAddCopies does not throw when no session is cached", () => {
    expect(() => renderHook(() => useAddCopies(), { wrapper: wrap(newClient()) })).not.toThrow();
  });

  it("useMoveCopies does not throw when no session is cached", () => {
    expect(() => renderHook(() => useMoveCopies(), { wrapper: wrap(newClient()) })).not.toThrow();
  });

  it("useDisposeCopies does not throw when no session is cached", () => {
    expect(() =>
      renderHook(() => useDisposeCopies(), { wrapper: wrap(newClient()) }),
    ).not.toThrow();
  });

  it("useBatchedAddCopies does not throw when no session is cached", () => {
    expect(() =>
      renderHook(() => useBatchedAddCopies(), { wrapper: wrap(newClient()) }),
    ).not.toThrow();
  });

  it("useUpdateCopies does not throw when no session is cached", () => {
    expect(() => renderHook(() => useUpdateCopies(), { wrapper: wrap(newClient()) })).not.toThrow();
  });
});

describe("useAddCopies", () => {
  it("mints a UUIDv7 id for a copy without one, so a replayed add cannot create a second row", async () => {
    const { client } = await signedInWithCopies([]);
    const { result } = renderHook(() => useAddCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copies: [{ printingId: "p1", collectionId: "col-1" }] });

    const body = sent[0]?.body as { copies: { id: string }[] };
    expect(body.copies[0]?.id).toMatch(UUID_V7);
  });

  it("resolves with the rows the API stored", async () => {
    const { client } = await signedInWithCopies([]);
    const { result } = renderHook(() => useAddCopies(), { wrapper: wrap(client) });

    const added = await result.current.mutateAsync({
      copies: [{ id: "c1", printingId: "p1", collectionId: "col-1" }],
    });

    expect(added.map((copy) => copy.id)).toEqual(["c1"]);
  });

  it("rejects while signed out", async () => {
    const { result } = renderHook(() => useAddCopies(), { wrapper: wrap(newClient()) });

    await expect(
      result.current.mutateAsync({ copies: [{ printingId: "p1", collectionId: "col-1" }] }),
    ).rejects.toThrow(/signed out/iu);
  });
});

describe("useMoveCopies", () => {
  it("clears groupId when taking a copy from a group box into a personal collection", async () => {
    const { client, collection } = await signedInWithCopies([
      stubCopy({ id: "c1", collectionId: "box", groupId: "group-1" }),
    ]);
    seedCollections(client, [
      { id: "box", groupId: "group-1" },
      { id: "inbox", groupId: null },
    ]);
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["c1"], toCollectionId: "inbox" });

    expect(collection.get("c1")).toMatchObject({ collectionId: "inbox", groupId: null });
  });

  it("sets groupId when contributing a personal copy to a group collection", async () => {
    const { client, collection } = await signedInWithCopies([
      stubCopy({ id: "c1", collectionId: "inbox", groupId: null }),
    ]);
    seedCollections(client, [
      { id: "inbox", groupId: null },
      { id: "box", groupId: "group-1" },
    ]);
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["c1"], toCollectionId: "box" });

    expect(collection.get("c1")).toMatchObject({ collectionId: "box", groupId: "group-1" });
  });

  it("skips ids that are no longer in the collection", async () => {
    const { client } = await signedInWithCopies([stubCopy({ id: "c1", collectionId: "source" })]);
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["gone", "c1"], toCollectionId: "dest" });

    expect(sent.map((request) => request.body)).toEqual([
      { copyIds: ["c1"], toCollectionId: "dest" },
    ]);
  });

  it("rejects while signed out", async () => {
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(newClient()) });

    await expect(
      result.current.mutateAsync({ copyIds: ["c1"], toCollectionId: "dest" }),
    ).rejects.toThrow(/signed out/iu);
  });
});

describe("useUpdateCopies", () => {
  it("applies the edit to the stored copy", async () => {
    const { client, collection } = await signedInWithCopies([stubCopy({ id: "c1" })]);
    const { result } = renderHook(() => useUpdateCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["c1"], patch: { condition: "mint" } });

    expect(collection.get("c1")?.condition).toBe("mint");
  });

  it("rejects while signed out", async () => {
    const { result } = renderHook(() => useUpdateCopies(), { wrapper: wrap(newClient()) });

    await expect(
      result.current.mutateAsync({ copyIds: ["c1"], patch: { condition: "mint" } }),
    ).rejects.toThrow(/signed out/iu);
  });
});

describe("useDisposeCopies", () => {
  it("removes the disposed copies", async () => {
    const { client, collection } = await signedInWithCopies([
      stubCopy({ id: "c1" }),
      stubCopy({ id: "c2" }),
    ]);
    const { result } = renderHook(() => useDisposeCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["c1"] });

    expect(collection.toArray.map((copy) => copy.id)).toEqual(["c2"]);
  });

  it("rejects while signed out", async () => {
    const { result } = renderHook(() => useDisposeCopies(), { wrapper: wrap(newClient()) });

    await expect(result.current.mutateAsync({ copyIds: ["c1"] })).rejects.toThrow(/signed out/iu);
  });
});

describe("useBatchedAddCopies", () => {
  it("shows each add at once and sends rapid adds as one request", async () => {
    const { client, collection } = await signedInWithCopies([]);
    const { result } = renderHook(() => useBatchedAddCopies(), { wrapper: wrap(client) });

    const first = result.current.add("p1", "col-1");
    const second = result.current.add("p2", "col-1");
    expect(collection.toArray).toHaveLength(2);

    const stored = await Promise.all([first, second]);

    expect(sent.filter((request) => request.path === "/api/v1/copies")).toHaveLength(1);
    expect(stored.map((copy) => copy.printingId)).toEqual(["p1", "p2"]);
  });

  it("sends the copy id and batch id the caller passes", async () => {
    const { client } = await signedInWithCopies([]);
    const { result } = renderHook(() => useBatchedAddCopies(), { wrapper: wrap(client) });

    await result.current.add("p1", "col-1", "given-1", "batch-1");

    expect(sent[0]?.body).toEqual({
      batchId: "batch-1",
      copies: [{ id: "given-1", printingId: "p1", collectionId: "col-1" }],
    });
  });

  it("sends the open batch when the view unmounts before the delay elapses", async () => {
    const { client } = await signedInWithCopies([]);
    const { result, unmount } = renderHook(() => useBatchedAddCopies(), { wrapper: wrap(client) });

    const stored = result.current.add("p1", "col-1");
    unmount();

    await vi.waitFor(() =>
      expect(sent.filter((request) => request.path === "/api/v1/copies")).toHaveLength(1),
    );
    await expect(stored).resolves.toMatchObject({ printingId: "p1" });
  });

  it("rejects every add in a failed batch and reports the batch", async () => {
    const { client, collection } = await signedInWithCopies([]);
    respond = () => Response.json({ message: "boom" }, { status: 500 });
    const onBatchError = vi.fn();
    const { result } = renderHook(() => useBatchedAddCopies({ onBatchError }), {
      wrapper: wrap(client),
    });

    const adds = [result.current.add("p1", "col-1"), result.current.add("p2", "col-1")];

    await expect(Promise.all(adds)).rejects.toThrow();
    await vi.waitFor(() =>
      expect(onBatchError).toHaveBeenCalledWith(["p1", "p2"], expect.any(Error)),
    );
    expect(collection.toArray).toEqual([]);
  });
});

describe("moves and disposals that would cancel pending trades", () => {
  const TRADE = {
    id: "e0000000-0001-4000-a000-000000000001",
    cardId: "card-1",
    printingId: "p1",
    quantity: 1,
    counterpartyName: "Mara",
  };
  const LATE_TRADE = {
    ...TRADE,
    id: "e0000000-0001-4000-a000-000000000002",
    counterpartyName: "Jax",
  };
  const GIVING_P1: CardTradeLiveAnnotation = {
    printingId: "p1",
    role: "giver",
    phase: "asked",
    tradeCount: 1,
    quantity: 1,
  };

  function conflict(trades: (typeof TRADE)[]): Response {
    return Response.json(
      {
        defined: true,
        code: "CONFLICT",
        status: 409,
        message: "This change would cancel pending trades. Confirm to cancel them.",
        data: { trades },
      },
      { status: 409 },
    );
  }

  async function answerNext(confirmed: boolean) {
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    const asked = useTradeCancelConsentStore.getState().request?.trades;
    useTradeCancelConsentStore.getState().answer(confirmed);
    return asked;
  }

  const paths = () => sent.map((request) => request.path);

  beforeEach(() => {
    useTradeCancelConsentStore.setState({ request: null });
  });

  it("skips the check when the viewer gives none of the selected printings in a pending trade", async () => {
    const { client, collection } = await signedInWithCopies(
      [stubCopy({ id: "c1", printingId: "p1", collectionId: "source" })],
      [
        { ...GIVING_P1, printingId: "p-other" },
        { ...GIVING_P1, role: "receiver" },
        { ...GIVING_P1, phase: "reserved" },
      ],
    );
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ copyIds: ["c1"], toCollectionId: "dest" });

    expect(paths()).toEqual(["/api/v1/copies/move"]);
    expect(collection.get("c1")?.collectionId).toBe("dest");
  });

  it("asks before moving and sends the confirmed trade ids with the move", async () => {
    const { client, collection } = await signedInWithCopies(
      [stubCopy({ id: "c1", printingId: "p1", collectionId: "source" })],
      [GIVING_P1],
    );
    respond = (request) =>
      request.path === "/api/v1/copies/trade-cancels/move"
        ? Response.json({ trades: [TRADE] })
        : succeed(request);
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    const pending = result.current.mutateAsync({ copyIds: ["c1"], toCollectionId: "dest" });
    await waitFor(() => expect(useTradeCancelConsentStore.getState().request).not.toBeNull());
    expect(collection.get("c1")?.collectionId).toBe("source");
    expect(await answerNext(true)).toEqual([TRADE]);
    await pending;

    expect(sent).toEqual([
      {
        path: "/api/v1/copies/trade-cancels/move",
        body: { copyIds: ["c1"], toCollectionId: "dest" },
      },
      {
        path: "/api/v1/copies/move",
        body: { copyIds: ["c1"], toCollectionId: "dest", cancelTradeIds: [TRADE.id] },
      },
    ]);
    expect(collection.get("c1")?.collectionId).toBe("dest");
    expect(client.getQueryState(tradesKeys.liveByPrinting(USER))?.isInvalidated).toBe(true);
  });

  it("declining the check sends no write and leaves the store exactly as it was", async () => {
    const rows = [
      stubCopy({ id: "c1", printingId: "p1", collectionId: "source" }),
      stubCopy({ id: "c2", printingId: "p1", collectionId: "source" }),
    ];
    const { client, collection } = await signedInWithCopies(rows, [GIVING_P1]);
    respond = (request) =>
      request.path === "/api/v1/copies/trade-cancels/dispose"
        ? Response.json({ trades: [TRADE] })
        : succeed(request);
    const before = collection.toArray.map((row) => ({ ...row }));
    const { result } = renderHook(() => useDisposeCopies(), { wrapper: wrap(client) });

    const outcome = result.current
      .mutateAsync({ copyIds: ["c1"] })
      .catch((error: unknown) => error);
    await answerNext(false);

    expect(await outcome).toBeInstanceOf(UserDeclinedError);
    expect(paths()).toEqual(["/api/v1/copies/trade-cancels/dispose"]);
    expect(collection.toArray).toEqual(before);
  });

  it("goes ahead with the write when the check fails, for a copy whose add is still in flight", async () => {
    const { client, collection } = await signedInWithCopies([], [GIVING_P1]);
    respond = (request) =>
      request.path === "/api/v1/copies/trade-cancels/dispose"
        ? Response.json({ message: "One or more copies not found" }, { status: 404 })
        : succeed(request);
    const adder = renderHook(() => useBatchedAddCopies(), { wrapper: wrap(client) });
    const disposer = renderHook(() => useDisposeCopies(), { wrapper: wrap(client) });

    const added = adder.result.current.add("p1", "source", "c-new");
    await disposer.result.current.mutateAsync({ copyIds: ["c-new"] });
    await added;

    expect(paths()).toEqual([
      "/api/v1/copies/trade-cancels/dispose",
      "/api/v1/copies",
      "/api/v1/copies/dispose",
    ]);
    expect(collection.has("c-new")).toBe(false);
  });

  it("a refusal the skipped check missed asks, and declining rolls the optimistic move back", async () => {
    const { client, collection } = await signedInWithCopies([
      stubCopy({ id: "c1", printingId: "p1", collectionId: "source" }),
    ]);
    respond = (request) =>
      request.path === "/api/v1/copies/move" ? conflict([TRADE]) : succeed(request);
    const before = collection.toArray.map((row) => ({ ...row }));
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    const outcome = result.current
      .mutateAsync({ copyIds: ["c1"], toCollectionId: "dest" })
      .catch((error: unknown) => error);
    await answerNext(false);

    expect(await outcome).toBeInstanceOf(UserDeclinedError);
    expect(paths()).toEqual(["/api/v1/copies/move"]);
    expect(collection.toArray).toEqual(before);
  });

  function manyCopies(count: number) {
    return Array.from({ length: count }, (_, index) =>
      stubCopy({ id: `c${index}`, printingId: "p1", collectionId: "source" }),
    );
  }

  function refuseSecondChunkOnce() {
    let refused = false;
    respond = (request) => {
      if (request.path === "/api/v1/copies/trade-cancels/move") {
        return Response.json({ trades: [TRADE] });
      }
      const body = request.body as { copyIds?: string[] };
      if (request.path === "/api/v1/copies/move" && body.copyIds?.length === 1 && !refused) {
        refused = true;
        return conflict([TRADE, LATE_TRADE]);
      }
      return succeed(request);
    };
  }

  it("asks about a trade a later chunk would cancel alone, then sends every confirmed id", async () => {
    const { client, collection } = await signedInWithCopies(manyCopies(501), [GIVING_P1]);
    refuseSecondChunkOnce();
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    const pending = result.current.mutateAsync({
      copyIds: manyCopies(501).map((copy) => copy.id),
      toCollectionId: "dest",
    });
    expect(await answerNext(true)).toEqual([TRADE]);
    expect(await answerNext(true)).toEqual([LATE_TRADE]);
    await pending;

    const moves = sent.filter((request) => request.path === "/api/v1/copies/move");
    expect(
      moves.map((request) => (request.body as { cancelTradeIds: string[] }).cancelTradeIds),
    ).toEqual([[TRADE.id], [TRADE.id], [TRADE.id, LATE_TRADE.id]]);
    expect(collection.toArray.every((copy) => copy.collectionId === "dest")).toBe(true);
  });

  it("declining at a later chunk keeps the earlier chunk and reports how far it got", async () => {
    const { client, collection } = await signedInWithCopies(manyCopies(501), [GIVING_P1]);
    refuseSecondChunkOnce();
    const { result } = renderHook(() => useMoveCopies(), { wrapper: wrap(client) });

    const outcome = result.current
      .mutateAsync({ copyIds: manyCopies(501).map((copy) => copy.id), toCollectionId: "dest" })
      .catch((error: unknown) => error);
    await answerNext(true);
    await answerNext(false);

    const error = await outcome;
    expect(error).not.toBeInstanceOf(UserDeclinedError);
    expect((error as Error).message).toMatch(/500 of 501/u);
    expect(collection.toArray.filter((copy) => copy.collectionId === "dest")).toHaveLength(500);
    expect(collection.get("c500")?.collectionId).toBe("source");
  });
});
