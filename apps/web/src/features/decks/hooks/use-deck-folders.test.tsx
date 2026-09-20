import type { DeckFolderResponse, DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler:
        (fn: (args: { context: { cookie: string | undefined }; data: unknown }) => unknown) =>
        (input: { data: unknown }) =>
          fn({ context: { cookie: undefined }, ...input }),
      validator: () => chain,
      middleware: () => chain,
    };
    return chain;
  },
  createMiddleware: () => ({ server: () => ({}) }),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://localhost"),
}));

let currentUserId: string | null = "user-1";

vi.mock("@/lib/auth-session", () => ({
  useRequiredUserId: () => {
    if (currentUserId === null) {
      throw new Error("useRequiredUserId() called without an authenticated session.");
    }
    return currentUserId;
  },
  useSession: () => ({ data: currentUserId === null ? null : { user: { id: currentUserId } } }),
  useUserId: () => currentUserId,
}));

const { getDeckFoldersCollection, getDecksCollection } =
  await import("@/features/decks/lib/decks-collection");
const {
  useCreateDeckFolder,
  useDeckFolders,
  useRemoveDeckFolder,
  useRenameDeckFolder,
  useReorderDeckFolders,
  useSetDeckFolders,
} = await import("./use-deck-folders");

const USER = "user-1";
const DECK_ID = "0191a9c4-2f3e-7c1d-9b4a-3f0c6d2e8a11";
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function folderRow(overrides: Partial<DeckFolderResponse> = {}): DeckFolderResponse {
  return {
    id: "folder-1",
    name: "Aggro",
    sortOrder: 0,
    deckCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function deckRow(id: string): DeckListItemResponse {
  return {
    deck: {
      id,
      name: "Poro Party",
      descriptionSnippet: null,
      description: null,
      links: [],
      oddsConfig: null,
      isPublic: false,
      shareToken: null,
      format: WellKnown.deckFormat.CONSTRUCTED,
      formatConfig: null,
      isPinned: false,
      archivedAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      coverCardId: null,
      coverPrintingId: null,
      coverPosition: null,
      collectionId: null,
      familyId: null,
      predecessorDeckId: null,
      isPrimary: false,
      isDraft: false,
    },
    legendCardId: null,
    championCardId: null,
    totalCards: 0,
    typeCounts: [],
    domainDistribution: [],
    isValid: false,
    requiredProgress: 0,
    requiredTotal: 0,
    totalValueCents: null,
    missingCount: null,
    folderIds: [],
  } as unknown as DeckListItemResponse;
}

interface SentRequest {
  method: string;
  path: string;
  body: unknown;
}

let serverFolders: DeckFolderResponse[];
let serverDecks: DeckListItemResponse[];
let sent: SentRequest[];
let respond: (request: SentRequest) => Response | Promise<Response>;

async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.clone().text();
  return text === "" ? undefined : JSON.parse(text);
}

function succeed(request: SentRequest): Response {
  const { method, path, body } = request;
  if (method === "GET" && path === "/api/v1/deck-folders") {
    return Response.json({ items: serverFolders });
  }
  if (method === "GET" && path === "/api/v1/decks") {
    return Response.json({ items: serverDecks });
  }
  if (method === "POST" && path === "/api/v1/deck-folders") {
    const { id, name } = body as { id: string; name: string };
    const row = folderRow({
      id,
      name,
      sortOrder: Math.max(-1, ...serverFolders.map((folder) => folder.sortOrder)) + 1,
    });
    serverFolders = [...serverFolders, row];
    return Response.json(row, { status: 201 });
  }
  if (method === "PATCH" && path.startsWith("/api/v1/deck-folders/")) {
    const id = path.split("/").at(-1) ?? "";
    const { name } = body as { name: string };
    serverFolders = serverFolders.map((folder) =>
      folder.id === id ? { ...folder, name } : folder,
    );
    return Response.json(serverFolders.find((folder) => folder.id === id));
  }
  if (method === "DELETE" && path.startsWith("/api/v1/deck-folders/")) {
    const id = path.split("/").at(-1) ?? "";
    serverFolders = serverFolders.filter((folder) => folder.id !== id);
    return new Response(null, { status: 204 });
  }
  if (method === "POST" && path === "/api/v1/deck-folders/reorder") {
    const { orderedIds } = body as { orderedIds: string[] };
    serverFolders = serverFolders.map((folder) => {
      const index = orderedIds.indexOf(folder.id);
      return index === -1 ? folder : { ...folder, sortOrder: index };
    });
    return new Response(null, { status: 204 });
  }
  if (method === "PUT" && path.endsWith("/folders")) {
    return Response.json({ items: serverFolders });
  }
  return new Response(null, { status: 204 });
}

function refuse(): Response {
  return Response.json({ message: "Service unavailable" }, { status: 500 });
}

beforeEach(() => {
  currentUserId = USER;
  serverFolders = [];
  serverDecks = [];
  sent = [];
  respond = succeed;
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
});

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useDeckFolders", () => {
  it("returns folders sorted by sortOrder then name", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [
      folderRow({ id: "bravo", name: "Bravo", sortOrder: 1 }),
      folderRow({ id: "zulu", name: "Zulu", sortOrder: 0 }),
      folderRow({ id: "alpha", name: "Alpha", sortOrder: 0 }),
    ];
    await getDeckFoldersCollection(client, USER).preload();

    const { result } = renderHook(() => useDeckFolders(), { wrapper: wrap(client) });

    await waitFor(() => {
      expect(result.current.data?.map((folder) => folder.id)).toEqual(["alpha", "zulu", "bravo"]);
    });
  });

  it("returns `{ data: undefined }` when signed out", () => {
    currentUserId = null;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useDeckFolders(), { wrapper: wrap(client) });

    expect(result.current).toEqual({ data: undefined });
  });
});

describe("useCreateDeckFolder", () => {
  it("sends a client uuid id and a sortOrder one past the highest existing, resolving with the stored row", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [folderRow({ id: "a", sortOrder: 0 }), folderRow({ id: "c", sortOrder: 2 })];
    await getDeckFoldersCollection(client, USER).preload();
    sent = [];
    const { result } = renderHook(() => useCreateDeckFolder(), { wrapper: wrap(client) });

    const created = await result.current.mutateAsync({ name: "Control" });

    const posted = sent.find((request) => request.method === "POST");
    const postedBody = posted?.body as { id: string; name: string };
    expect(postedBody.id).toMatch(UUID_V7);
    expect(postedBody.name).toBe("Control");
    expect(created).toMatchObject({ id: postedBody.id, name: "Control", sortOrder: 3 });
  });
});

describe("useRenameDeckFolder", () => {
  it("sends the new name", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [folderRow({ id: "a", name: "Old" })];
    const collection = getDeckFoldersCollection(client, USER);
    await collection.preload();
    sent = [];
    const { result } = renderHook(() => useRenameDeckFolder(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: "a", name: "New Name" });

    const patched = sent.find((request) => request.method === "PATCH");
    expect(patched?.body).toEqual({ name: "New Name" });
    expect(collection.get("a")?.name).toBe("New Name");
  });

  it("is a no-op for an unknown id", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await getDeckFoldersCollection(client, USER).preload();
    sent = [];
    const { result } = renderHook(() => useRenameDeckFolder(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: "missing", name: "New Name" });

    expect(sent).toEqual([]);
  });

  it("rolls back the name and rejects when the server errors", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [folderRow({ id: "a", name: "Old" })];
    const collection = getDeckFoldersCollection(client, USER);
    await collection.preload();
    respond = (request) => (request.method === "PATCH" ? refuse() : succeed(request));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useRenameDeckFolder(), { wrapper: wrap(client) });

    await expect(result.current.mutateAsync({ id: "a", name: "New Name" })).rejects.toThrow();

    expect(collection.get("a")?.name).toBe("Old");
    errorSpy.mockRestore();
  });
});

describe("useRemoveDeckFolder", () => {
  it("sends DELETE and drops the row", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [folderRow({ id: "a" })];
    const collection = getDeckFoldersCollection(client, USER);
    await collection.preload();
    sent = [];
    const { result } = renderHook(() => useRemoveDeckFolder(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: "a" });

    expect(
      sent.some(
        (request) => request.method === "DELETE" && request.path === "/api/v1/deck-folders/a",
      ),
    ).toBe(true);
    expect(collection.has("a")).toBe(false);
  });

  it("is a no-op for an unknown id", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await getDeckFoldersCollection(client, USER).preload();
    sent = [];
    const { result } = renderHook(() => useRemoveDeckFolder(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: "missing" });

    expect(sent).toEqual([]);
  });
});

describe("useReorderDeckFolders", () => {
  it("sends one reorder request with the full order", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverFolders = [folderRow({ id: "a", sortOrder: 0 }), folderRow({ id: "b", sortOrder: 1 })];
    const collection = getDeckFoldersCollection(client, USER);
    await collection.preload();
    sent = [];
    const { result } = renderHook(() => useReorderDeckFolders(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ orderedIds: ["b", "a"] });

    const reorders = sent.filter((request) => request.path === "/api/v1/deck-folders/reorder");
    expect(reorders).toHaveLength(1);
    expect(reorders[0]?.body).toEqual({ orderedIds: ["b", "a"] });
  });
});

describe("useSetDeckFolders", () => {
  it("writes folderIds onto the deck row via PUT /api/v1/decks/{id}/folders", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    serverDecks = [deckRow(DECK_ID)];
    const decks = getDecksCollection(client, USER);
    await decks.preload();
    sent = [];
    const { result } = renderHook(() => useSetDeckFolders(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: DECK_ID, folderIds: ["folder-1"] });

    const put = sent.find((request) => request.method === "PUT");
    expect(put?.path).toBe(`/api/v1/decks/${DECK_ID}/folders`);
    expect(put?.body).toEqual({ folderIds: ["folder-1"] });
    expect(decks.get(DECK_ID)?.folderIds).toEqual(["folder-1"]);
  });

  it("is a no-op for an unknown deck", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const decks = getDecksCollection(client, USER);
    await decks.preload();
    sent = [];
    const { result } = renderHook(() => useSetDeckFolders(), { wrapper: wrap(client) });

    await result.current.mutateAsync({ id: "missing", folderIds: ["folder-1"] });

    expect(sent).toEqual([]);
  });
});
