import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";
import { stubCollection, stubCopy } from "@/test/factories";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

vi.mock("@/lib/server-fns/middleware", () => ({
  withCookies: () => {},
}));

const { getCollectionsCollection } =
  await import("@/features/collections/lib/collections-collection");
const { getCopiesCollection } = await import("@/features/collections/lib/copies-collection");
const {
  useCollections,
  useCollectionsList,
  useCreateCollection,
  useReorderCollections,
  useSetCollectionSidebarHidden,
} = await import("./use-collections");

const USER = "user-1";

interface SentRequest {
  method: string;
  path: string;
  body: unknown;
}

let serverCollections: CollectionResponse[];
let sent: SentRequest[];
let respond: (request: SentRequest) => Response | Promise<Response>;

// A fake server, not a fixed payload: these handlers refetch, so the next GET
// is what lands in the store.
function succeed(request: SentRequest): Response {
  if (request.method === "GET") {
    return Response.json({ items: serverCollections });
  }
  if (request.method === "POST" && request.path === "/api/v1/collections") {
    return Response.json(stubCollection(request.body as Partial<CollectionResponse>), {
      status: 201,
    });
  }
  if (request.method === "PUT" && request.path.endsWith("/sidebar")) {
    const { hidden } = request.body as { hidden: boolean };
    const id = request.path.split("/")[4] ?? "";
    serverCollections = serverCollections.map((row) =>
      row.id === id ? { ...row, sidebarHidden: hidden } : row,
    );
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 204 });
}

function refuse(): Response {
  return Response.json({ message: "Service unavailable" }, { status: 503 });
}

async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.clone().text();
  return text === "" ? undefined : JSON.parse(text);
}

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <Suspense fallback={null}>{children}</Suspense>
      </QueryClientProvider>
    );
  };
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

async function signedInWithCollections(client: QueryClient, rows: CollectionResponse[]) {
  seedSession(client);
  serverCollections = rows;
  const collection = getCollectionsCollection(client, USER);
  await collection.preload();
  return collection;
}

beforeEach(() => {
  serverCollections = [];
  sent = [];
  respond = succeed;
  fetchCopies.mockReset();
  fetchCopies.mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(toast.error).mockClear();
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
});

describe("useCollections", () => {
  function twoCollections(client: QueryClient) {
    seedSession(client);
    serverCollections = [
      stubCollection({ id: "trades", name: "Trades", sortOrder: 2 }),
      stubCollection({ id: "inbox", isInbox: true, copyCount: 99 }),
    ];
    fetchCopies.mockResolvedValue({
      items: [stubCopy({ collectionId: "inbox" }), stubCopy({ collectionId: "inbox" })],
      nextCursor: null,
    });
  }

  it("lists the viewer's collections in sidebar order with live copy counts once the copies store is syncing", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    twoCollections(client);
    await getCopiesCollection(client, USER).preload();

    const { result } = renderHook(() => useCollections(), { wrapper: wrap(client) });

    await waitFor(() => {
      expect(result.current.data.map((col) => [col.id, col.copyCount])).toEqual([
        ["inbox", 2],
        ["trades", 0],
      ]);
    });
  });

  it("keeps the server's counts and never starts the copies store on its own", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    twoCollections(client);

    const { result } = renderHook(() => useCollections(), { wrapper: wrap(client) });

    await waitFor(() => {
      expect(result.current.data.map((col) => [col.id, col.copyCount])).toEqual([
        ["inbox", 99],
        ["trades", 0],
      ]);
    });
    expect(fetchCopies).not.toHaveBeenCalled();
  });
});

describe("useCollectionsList", () => {
  it("is undefined while nobody is signed in", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useCollectionsList(), { wrapper: wrap(client) });

    expect(result.current).toBeUndefined();
  });
});

describe("useCreateCollection", () => {
  it("sends a client id and resolves with the collection the API stored", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await signedInWithCollections(client, []);
    const { result } = renderHook(() => useCreateCollection(), { wrapper: wrap(client) });

    const created = await result.current.mutateAsync({ name: "Summoner Skirmish" });

    expect(created.name).toBe("Summoner Skirmish");
    expect(sent.find((request) => request.method === "POST")?.body).toMatchObject({
      id: created.id,
      name: "Summoner Skirmish",
    });
  });
});

describe("useSetCollectionSidebarHidden", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("hides the row before the API answers", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const collection = await signedInWithCollections(client, [stubCollection({ id: "col-1" })]);
    let release = () => {};
    // oxlint-disable-next-line promise/avoid-new -- held open so the optimistic state is observable
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    respond = async (request) => {
      if (request.method === "PUT") {
        await gate;
      }
      return succeed(request);
    };
    const { result } = renderHook(() => useSetCollectionSidebarHidden(), {
      wrapper: wrap(client),
    });

    const pending = result.current.mutateAsync({ id: "col-1", hidden: true });

    await waitFor(() => expect(collection.get("col-1")?.sidebarHidden).toBe(true));
    release();
    await pending;
    // The refetch reaches synced state on the tick after the mutation settles.
    await waitFor(() => expect(collection.get("col-1")?.sidebarHidden).toBe(true));
  });

  it("restores the previous visibility and reports the failure", async () => {
    const client = createQueryClient();
    const collection = await signedInWithCollections(client, [stubCollection({ id: "col-1" })]);
    respond = (request) => (request.method === "PUT" ? refuse() : succeed(request));
    const { result } = renderHook(() => useSetCollectionSidebarHidden(), {
      wrapper: wrap(client),
    });

    await expect(result.current.mutateAsync({ id: "col-1", hidden: true })).rejects.toThrow();

    expect(collection.get("col-1")?.sidebarHidden).toBe(false);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
    });
  });
});

describe("useReorderCollections", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("restores the previous order and reports the failure", async () => {
    const client = createQueryClient();
    const collection = await signedInWithCollections(client, [
      stubCollection({ id: "col-1", sortOrder: 0 }),
      stubCollection({ id: "col-2", sortOrder: 1 }),
    ]);
    respond = (request) => (request.method === "POST" ? refuse() : succeed(request));
    const { result } = renderHook(() => useReorderCollections(), { wrapper: wrap(client) });

    await expect(result.current.mutateAsync({ orderedIds: ["col-2", "col-1"] })).rejects.toThrow();

    expect(collection.get("col-1")?.sortOrder).toBe(0);
    expect(collection.get("col-2")?.sortOrder).toBe(1);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.any(String), PERSISTENT_ERROR_TOAST);
    });
  });
});
