import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubCollection, stubCopy } from "@/test/factories";

import { getCollectionsCollection } from "./collections-collection";
import { reorderCollections } from "./collections-write";
import { getCopiesCollection } from "./copies-collection";

const fetchCopies = vi.hoisted(() => vi.fn());
vi.mock("@/features/collections/lib/copies-query", () => ({ fetchCopies }));

const userId = "user-1";

interface SentRequest {
  method: string;
  path: string;
  body: unknown;
}

let queryClient: QueryClient;
let serverCollections: CollectionResponse[];
let sent: SentRequest[];
let respond: (request: SentRequest) => Response;

function idFromPath(path: string): string {
  return path.split("/")[4] ?? "";
}

function applyToServer(id: string, changes: Partial<CollectionResponse>): void {
  serverCollections = serverCollections.map((row) =>
    row.id === id ? { ...row, ...changes } : row,
  );
}

// A fake server, not a fixed payload: these handlers refetch, so the next GET
// is what lands in the store.
function succeed({ method, path, body }: SentRequest): Response {
  if (method === "GET") {
    return Response.json({ items: serverCollections });
  }
  if (method === "POST" && path === "/api/v1/collections") {
    const created = stubCollection(body as Partial<CollectionResponse>);
    serverCollections = [...serverCollections, created];
    return Response.json(created, { status: 201 });
  }
  if (method === "POST" && path === "/api/v1/collections/reorder") {
    const { orderedIds } = body as { orderedIds: string[] };
    serverCollections = serverCollections.map((row) => {
      const index = orderedIds.indexOf(row.id);
      return index === -1 ? row : { ...row, sortOrder: index };
    });
    return new Response(null, { status: 204 });
  }
  if (method === "POST" && path.endsWith("/share")) {
    applyToServer(idFromPath(path), { isPublic: true, shareToken: "token-1" });
    return Response.json({ shareToken: "token-1", isPublic: true });
  }
  if (method === "DELETE" && path.endsWith("/share")) {
    applyToServer(idFromPath(path), { isPublic: false, shareToken: null });
    return new Response(null, { status: 204 });
  }
  if (method === "PATCH") {
    const { name, description } = body as Partial<CollectionResponse>;
    applyToServer(idFromPath(path), {
      ...(name === undefined ? {} : { name }),
      ...(description === undefined ? {} : { description }),
    });
    return Response.json(stubCollection());
  }
  if (method === "PUT" && path.endsWith("/deckbuilding")) {
    const { available } = body as { available: boolean };
    applyToServer(idFromPath(path), { availableForDeckbuilding: available });
    return new Response(null, { status: 204 });
  }
  if (method === "PUT" && path.endsWith("/sidebar")) {
    const { hidden } = body as { hidden: boolean };
    applyToServer(idFromPath(path), { sidebarHidden: hidden });
    return new Response(null, { status: 204 });
  }
  if (method === "DELETE") {
    const id = idFromPath(path);
    serverCollections = serverCollections.filter((row) => row.id !== id);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204 });
}

async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.clone().text();
  return text === "" ? undefined : JSON.parse(text);
}

async function collectionsOnServer(rows: CollectionResponse[]) {
  serverCollections = rows;
  const collection = getCollectionsCollection(queryClient, userId);
  // A live query keeps sync running; without a subscriber the adapter pauses it
  // and fetch results never reach synced state.
  collection.subscribeChanges(() => {});
  await collection.preload();
  sent = [];
  return collection;
}

/** The writes a test cares about, without the refetch that follows each one. */
function writes(): SentRequest[] {
  return sent.filter((request) => request.method !== "GET");
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  serverCollections = [];
  sent = [];
  respond = succeed;
  fetchCopies.mockReset();
  fetchCopies.mockResolvedValue({ items: [], nextCursor: null });
  vi.stubGlobal("location", { origin: "http://localhost" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const request = {
        method: input.method,
        path: new URL(input.url).pathname,
        body: await bodyOf(input),
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

describe("persisting collection writes", () => {
  it("creates a collection with its client id and takes the row from the refetch", async () => {
    const collection = await collectionsOnServer([]);

    await collection.insert(stubCollection({ id: "col-1", name: "Summoner Skirmish" })).isPersisted
      .promise;

    expect(writes()).toEqual([
      {
        method: "POST",
        path: "/api/v1/collections",
        body: {
          id: "col-1",
          name: "Summoner Skirmish",
          description: null,
          availableForDeckbuilding: true,
        },
      },
    ]);
    await vi.waitFor(() => {
      expect(collection.get("col-1")?.name).toBe("Summoner Skirmish");
    });
  });

  it("refetches after a write, so the store holds server state", async () => {
    const collection = await collectionsOnServer([stubCollection({ id: "col-1", name: "Old" })]);

    await collection.update("col-1", (draft) => {
      draft.name = "New";
    }).isPersisted.promise;

    expect(sent.at(-1)?.method).toBe("GET");
  });

  it("sends a rename to the update endpoint", async () => {
    const collection = await collectionsOnServer([stubCollection({ id: "col-1", name: "Old" })]);

    await collection.update("col-1", (draft) => {
      draft.name = "New";
    }).isPersisted.promise;

    expect(writes()).toEqual([
      { method: "PATCH", path: "/api/v1/collections/col-1", body: { name: "New" } },
    ]);
    // The refetch reaches synced state on the tick after the transaction settles.
    await vi.waitFor(() => {
      expect(collection.get("col-1")?.name).toBe("New");
    });
  });

  it("sends the deck-building and sidebar flags to their own endpoints", async () => {
    const collection = await collectionsOnServer([stubCollection({ id: "col-1" })]);

    await collection.update("col-1", (draft) => {
      draft.availableForDeckbuilding = false;
      draft.sidebarHidden = true;
    }).isPersisted.promise;

    expect(writes()).toEqual([
      {
        method: "PUT",
        path: "/api/v1/collections/col-1/deckbuilding",
        body: { available: false },
      },
      { method: "PUT", path: "/api/v1/collections/col-1/sidebar", body: { hidden: true } },
    ]);
    await vi.waitFor(() => {
      expect(collection.get("col-1")).toMatchObject({
        availableForDeckbuilding: false,
        sidebarHidden: true,
      });
    });
  });

  it("sends one reorder with the whole order and takes each new position from the refetch", async () => {
    const collection = await collectionsOnServer([
      stubCollection({ id: "inbox", isInbox: true, sortOrder: 0 }),
      stubCollection({ id: "binder", sortOrder: 1 }),
      stubCollection({ id: "trades", sortOrder: 2 }),
    ]);

    await reorderCollections(collection, ["inbox", "trades", "binder"]).isPersisted.promise;

    expect(writes()).toEqual([
      {
        method: "POST",
        path: "/api/v1/collections/reorder",
        body: { orderedIds: ["inbox", "trades", "binder"] },
      },
    ]);
    await vi.waitFor(() => {
      expect(collection.get("trades")?.sortOrder).toBe(1);
      expect(collection.get("binder")?.sortOrder).toBe(2);
    });
  });

  it("stores the share token the API issues", async () => {
    const collection = await collectionsOnServer([stubCollection({ id: "col-1" })]);

    await collection.update("col-1", (draft) => {
      draft.isPublic = true;
    }).isPersisted.promise;

    await vi.waitFor(() => {
      expect(collection.get("col-1")).toMatchObject({ isPublic: true, shareToken: "token-1" });
    });
  });

  it("moves a deleted collection's copies into the inbox and out of its group", async () => {
    fetchCopies.mockResolvedValue({
      items: [stubCopy({ id: "copy-1", collectionId: "pool", groupId: "group-1" })],
      nextCursor: null,
    });
    const copies = getCopiesCollection(queryClient, userId);
    await copies.preload();
    const collection = await collectionsOnServer([
      stubCollection({ id: "inbox", isInbox: true }),
      stubCollection({ id: "pool", groupId: "group-1" }),
    ]);

    await collection.delete("pool").isPersisted.promise;

    expect(writes()).toEqual([
      { method: "DELETE", path: "/api/v1/collections/pool", body: undefined },
    ]);
    await vi.waitFor(() => {
      expect(collection.has("pool")).toBe(false);
    });
    expect(copies.get("copy-1")).toMatchObject({ collectionId: "inbox", groupId: null });
  });

  it("rolls a rename back when the API refuses it", async () => {
    const collection = await collectionsOnServer([stubCollection({ id: "col-1", name: "Old" })]);
    respond = () => Response.json({ message: "boom" }, { status: 500 });

    await expect(
      collection.update("col-1", (draft) => {
        draft.name = "New";
      }).isPersisted.promise,
    ).rejects.toThrow();

    expect(collection.get("col-1")?.name).toBe("Old");
  });
});
