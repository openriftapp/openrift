import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { createTransaction } from "@tanstack/react-db";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubCopy } from "@/test/factories";

import { getCopiesCollection } from "./copies-collection";
import {
  persistCopyMutations,
  trackPendingInserts,
  updateCopyMetadata,
  waitForInsert,
} from "./copies-write";

const fetchCopies = vi.hoisted(() => vi.fn());
vi.mock("@/features/collections/lib/copies-query", () => ({ fetchCopies }));

const userId = "user-1";

interface SentRequest {
  path: string;
  body: unknown;
}

let queryClient: QueryClient;
let sent: SentRequest[];
let respond: (request: SentRequest) => Response | Promise<Response>;

function succeed(request: SentRequest): Response {
  if (request.path !== "/api/v1/copies") {
    return new Response(null, { status: 204 });
  }
  const { copies } = request.body as { copies: Partial<CopyResponse>[] };
  return Response.json({ items: copies.map((copy) => stubCopy(copy)) }, { status: 201 });
}

function fail(): Response {
  return Response.json({ message: "boom" }, { status: 500 });
}

async function copiesOnServer(rows: CopyResponse[]) {
  fetchCopies.mockResolvedValue({ items: rows, nextCursor: null });
  const collection = getCopiesCollection(queryClient, userId);
  await collection.preload();
  return collection;
}

function pendingInsert(collection: ReturnType<typeof getCopiesCollection>, row: CopyResponse) {
  const transaction = createTransaction<CopyResponse>({
    autoCommit: false,
    mutationFn: ({ transaction: batch }) =>
      persistCopyMutations(collection, batch.mutations, { queryClient, userId }),
  });
  transaction.mutate(() => {
    collection.insert(row);
  });
  trackPendingInserts(collection, [row.id], transaction);
  return transaction;
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  sent = [];
  respond = succeed;
  fetchCopies.mockReset();
  vi.stubGlobal("location", { origin: "http://localhost" });
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
  queryClient.clear();
});

describe("persisting copy writes", () => {
  it("starts the store's sync before writing an add into a store nothing has read yet", async () => {
    fetchCopies.mockResolvedValue({
      items: [stubCopy({ id: "c1", printingId: "p1", collectionId: "col-1" })],
      nextCursor: null,
    });
    const collection = getCopiesCollection(queryClient, userId);

    await collection.insert(stubCopy({ id: "c1", printingId: "p1", collectionId: "col-1" }))
      .isPersisted.promise;

    expect(collection.get("c1")?.collectionId).toBe("col-1");
  });

  it("sends added copies with their client ids and stores the rows the API returns", async () => {
    const collection = await copiesOnServer([]);

    await collection.insert(stubCopy({ id: "c1", printingId: "p1", collectionId: "col-1" }))
      .isPersisted.promise;

    expect(sent).toEqual([
      {
        path: "/api/v1/copies",
        body: { copies: [{ id: "c1", printingId: "p1", collectionId: "col-1" }] },
      },
    ]);
    expect(collection.get("c1")?.collectionId).toBe("col-1");
  });

  it("sends only the details a new copy has set", async () => {
    const collection = await copiesOnServer([]);

    await collection.insert(
      stubCopy({
        id: "c1",
        printingId: "p1",
        collectionId: "col-1",
        condition: "NM",
        isAltered: true,
      }),
    ).isPersisted.promise;

    expect(sent[0]?.body).toEqual({
      copies: [
        { id: "c1", printingId: "p1", collectionId: "col-1", condition: "NM", isAltered: true },
      ],
    });
  });

  it("sends a detail edit's whole patch so grader and grade travel together", async () => {
    const collection = await copiesOnServer([stubCopy({ id: "c1", grader: "PSA", grade: 9 })]);

    await updateCopyMetadata(collection, ["c1"], { grader: "PSA", grade: 10 }).isPersisted.promise;

    expect(sent).toEqual([
      {
        path: "/api/v1/copies/update",
        body: { copyIds: ["c1"], patch: { grader: "PSA", grade: 10, condition: null } },
      },
    ]);
    expect(collection.get("c1")?.grade).toBe(10);
  });

  it("keeps the moved chunks confirmed before a later chunk fails", async () => {
    const ids = Array.from({ length: 700 }, (_, index) => `c${index}`);
    const collection = await copiesOnServer(
      ids.map((id) => stubCopy({ id, collectionId: "source" })),
    );
    respond = (request) => (sent.length === 2 ? fail() : succeed(request));

    const move = collection.update(ids, (drafts) => {
      for (const draft of drafts) {
        draft.collectionId = "dest";
      }
    });

    await expect(move.isPersisted.promise).rejects.toThrow();
    expect(sent).toHaveLength(2);
    expect(collection.get("c0")?.collectionId).toBe("dest");
    expect(collection.get("c499")?.collectionId).toBe("dest");
    expect(collection.get("c699")?.collectionId).toBe("source");
  });

  it("keeps the removed chunks confirmed before a later chunk fails", async () => {
    const ids = Array.from({ length: 700 }, (_, index) => `c${index}`);
    const collection = await copiesOnServer(ids.map((id) => stubCopy({ id })));
    respond = (request) => (sent.length === 2 ? fail() : succeed(request));

    await expect(collection.delete(ids).isPersisted.promise).rejects.toThrow();

    expect(sent).toHaveLength(2);
    expect(collection.has("c0")).toBe(false);
    expect(collection.has("c499")).toBe(false);
    expect(collection.has("c699")).toBe(true);
  });

  it("waits for a pending add before moving the copy it creates", async () => {
    const collection = await copiesOnServer([]);
    const add = pendingInsert(collection, stubCopy({ id: "c1", collectionId: "col-1" }));

    const move = collection.update("c1", (draft) => {
      draft.collectionId = "col-2";
    });
    expect(collection.get("c1")?.collectionId).toBe("col-2");
    expect(sent).toEqual([]);

    await add.commit();
    await move.isPersisted.promise;

    expect(sent.map((request) => request.path)).toEqual(["/api/v1/copies", "/api/v1/copies/move"]);
    // Confirmed rows reach synced state on the tick after the transaction settles.
    await vi.waitFor(() => {
      expect(collection.get("c1")?.collectionId).toBe("col-2");
    });
  });

  it("drops a removal of a copy whose add failed", async () => {
    const collection = await copiesOnServer([]);
    respond = fail;
    const add = pendingInsert(collection, stubCopy({ id: "c1" }));
    const removal = collection.delete("c1");

    await expect(add.commit()).rejects.toThrow();
    await removal.isPersisted.promise;

    expect(sent.map((request) => request.path)).toEqual(["/api/v1/copies"]);
    expect(collection.has("c1")).toBe(false);
  });

  it("resolves a waiting add with the row the API stored", async () => {
    const collection = await copiesOnServer([]);
    respond = () =>
      Response.json({ items: [stubCopy({ id: "c1", groupId: "group-1" })] }, { status: 201 });
    const row = stubCopy({ id: "c1" });
    const add = pendingInsert(collection, row);
    const stored = waitForInsert(collection, row);

    await add.commit();

    await expect(stored).resolves.toMatchObject({ id: "c1", groupId: "group-1" });
  });

  it("rejects a waiting add when its request fails", async () => {
    const collection = await copiesOnServer([]);
    respond = fail;
    const row = stubCopy({ id: "c1" });
    const add = pendingInsert(collection, row);
    const stored = waitForInsert(collection, row);

    await expect(add.commit()).rejects.toThrow();

    await expect(stored).rejects.toThrow();
  });

  it("finishes a removal when another store write already dropped one of its rows", async () => {
    const collection = await copiesOnServer([stubCopy({ id: "c1" }), stubCopy({ id: "c2" })]);
    respond = (request) => {
      collection.utils.writeDelete(["c1"]);
      return succeed(request);
    };

    await collection.delete(["c1", "c2"]).isPersisted.promise;

    expect(collection.toArray).toEqual([]);
  });

  it("keeps rows removed when a copies fetch lands during a removal that spans chunks", async () => {
    const rows = Array.from({ length: 501 }, (_, index) => stubCopy({ id: `c${index}` }));
    let serverRows = rows;
    fetchCopies.mockImplementation(async () => ({ items: serverRows, nextCursor: null }));
    const collection = getCopiesCollection(queryClient, userId);
    await collection.preload();
    respond = async (request) => {
      if (sent.length === 1) {
        await collection.utils.refetch();
      }
      const { copyIds } = request.body as { copyIds: string[] };
      serverRows = serverRows.filter((row) => !copyIds.includes(row.id));
      return succeed(request);
    };

    await collection.delete(rows.map((row) => row.id)).isPersisted.promise;

    await vi.waitFor(() => expect(collection.toArray).toEqual([]));
  });

  it("refreshes collection totals after a move but not after a detail edit", async () => {
    const collection = await copiesOnServer([stubCopy({ id: "c1", collectionId: "source" })]);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey);

    await updateCopyMetadata(collection, ["c1"], { condition: "mint" }).isPersisted.promise;
    expect(invalidatedKeys()).not.toContainEqual(["collections", userId]);

    await collection.update("c1", (draft) => {
      draft.collectionId = "dest";
    }).isPersisted.promise;
    expect(invalidatedKeys()).toContainEqual(["collections", userId]);
  });
});

describe("confirmed writes survive a copies refetch that started before them", () => {
  async function withSlowRefetch(initial: CopyResponse[]) {
    const server = { rows: initial };
    let release = () => {};
    // oxlint-disable-next-line promise/avoid-new -- gate resolved from outside the fetch
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fetches = 0;
    fetchCopies.mockImplementation(async () => {
      fetches++;
      const rows = server.rows;
      if (fetches === 2) {
        await gate;
      }
      return { items: rows, nextCursor: null };
    });
    const collection = getCopiesCollection(queryClient, userId);
    await collection.preload();
    const refetching = collection.utils.refetch();
    return { collection, server, release, refetching };
  }

  async function landLateRefetch(release: () => void, refetching: Promise<unknown>) {
    release();
    await refetching.catch(() => {});
    await vi.waitFor(() => expect(queryClient.isFetching()).toBe(0));
    // oxlint-disable-next-line promise/avoid-new -- let queued result applications run
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  it("keeps an added copy", async () => {
    const { collection, server, release, refetching } = await withSlowRefetch([
      stubCopy({ id: "existing" }),
    ]);
    const row = stubCopy({ id: "added" });
    respond = (request) => {
      server.rows = [...server.rows, row];
      return succeed(request);
    };

    await collection.insert(row).isPersisted.promise;
    await landLateRefetch(release, refetching);

    expect(collection.toArray.map((copy) => copy.id).toSorted()).toEqual(["added", "existing"]);
  });

  it("keeps a moved copy in its new collection", async () => {
    const { collection, server, release, refetching } = await withSlowRefetch([
      stubCopy({ id: "c1", collectionId: "source" }),
    ]);
    respond = (request) => {
      server.rows = [stubCopy({ id: "c1", collectionId: "dest" })];
      return succeed(request);
    };

    await collection.update("c1", (draft) => {
      draft.collectionId = "dest";
    }).isPersisted.promise;
    await landLateRefetch(release, refetching);

    expect(collection.get("c1")?.collectionId).toBe("dest");
  });

  it("keeps an edited copy's new details", async () => {
    const { collection, server, release, refetching } = await withSlowRefetch([
      stubCopy({ id: "c1" }),
    ]);
    respond = (request) => {
      server.rows = [stubCopy({ id: "c1", condition: "mint" })];
      return succeed(request);
    };

    await updateCopyMetadata(collection, ["c1"], { condition: "mint" }).isPersisted.promise;
    await landLateRefetch(release, refetching);

    expect(collection.get("c1")?.condition).toBe("mint");
  });

  it("keeps a removed copy removed", async () => {
    const { collection, server, release, refetching } = await withSlowRefetch([
      stubCopy({ id: "c1" }),
    ]);
    respond = (request) => {
      server.rows = [];
      return succeed(request);
    };

    await collection.delete("c1").isPersisted.promise;
    await landLateRefetch(release, refetching);

    expect(collection.has("c1")).toBe(false);
  });
});
