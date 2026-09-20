import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, Suspense } from "react";
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

const { getDeckCardsCollection, getDecksCollection } =
  await import("@/features/decks/lib/decks-collection");
const { useCreateDeck, useDeckDetail, useDeleteDeck } = await import("./use-decks");

describe("useDeleteDeck", () => {
  afterEach(() => {
    currentUserId = "user-1";
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient();
    return createElement(QueryClientProvider, { client }, children);
  }

  it("mounts without a session", () => {
    currentUserId = null;

    const { result } = renderHook(() => useDeleteDeck(), { wrapper });

    expect(result.current.isPending).toBe(false);
  });

  it("mounts for a signed-in user", () => {
    const { result } = renderHook(() => useDeleteDeck(), { wrapper });

    expect(result.current.isPending).toBe(false);
  });
});

describe("useCreateDeck", () => {
  const DECK_ID = "0191a9c4-2f3e-7c1d-9b4a-3f0c6d2e8a11";
  let sent: { method: string; path: string }[];

  function stubDeckRow(): DeckListItemResponse {
    return {
      deck: {
        id: DECK_ID,
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

  beforeEach(() => {
    sent = [];
    vi.stubGlobal("location", { origin: "http://localhost" });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request) => {
        sent.push({ method: input.method, path: new URL(input.url).pathname });
        return Promise.resolve(Response.json({ items: [stubDeckRow()] }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the deck a retried claim already created instead of creating a second one", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await getDecksCollection(client, "user-1").preload();
    sent = [];
    const { result } = renderHook(() => useCreateDeck(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client }, children),
    });

    const created = await result.current.mutateAsync({
      id: DECK_ID,
      name: "Poro Party",
      format: WellKnown.deckFormat.CONSTRUCTED,
    });

    expect(created.id).toBe(DECK_ID);
    expect(sent).toEqual([]);
  });
});

describe("a deck read from the stores", () => {
  const DECK_ID = "0191a9c4-2f3e-7c1d-9b4a-3f0c6d2e8a11";
  const OTHER_ID = "0191a9c4-2f3e-7c1d-9b4a-3f0c6d2e8a22";

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

  function cardRow(deckId: string, cardId: string) {
    return {
      deckId,
      cardId,
      zone: WellKnown.deckZone.MAIN,
      quantity: 1,
      preferredPrintingId: null,
    };
  }

  let client: QueryClient;

  beforeEach(async () => {
    vi.stubGlobal("location", { origin: "http://localhost" });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request) => {
        const path = new URL(input.url).pathname;
        if (input.method === "GET" && path === "/api/v1/deck-cards") {
          return Promise.resolve(
            Response.json({
              items: [cardRow(DECK_ID, "card-a"), cardRow(OTHER_ID, "card-z")],
              syncedXid: "1000",
            }),
          );
        }
        if (input.method === "GET") {
          return Promise.resolve(Response.json({ items: [deckRow(DECK_ID), deckRow(OTHER_ID)] }));
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      }),
    );
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await Promise.all([
      getDecksCollection(client, "user-1").preload(),
      getDeckCardsCollection(client, "user-1").preload(),
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    client.clear();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client },
      createElement(Suspense, { fallback: null }, children),
    );
  }

  it("assembles the detail from the deck's own rows", async () => {
    const { result } = renderHook(() => useDeckDetail(DECK_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.data.deck.id).toBe(DECK_ID);
    });
    expect(result.current.data.cards.map((card) => card.cardId)).toEqual(["card-a"]);
  });

  it("drops a deleted deck's cards from the cards store", async () => {
    const { result } = renderHook(() => useDeleteDeck(), { wrapper });

    await result.current.mutateAsync(DECK_ID);

    const remaining = getDeckCardsCollection(client, "user-1").toArray;
    expect(remaining.map((row) => row.deckId)).toEqual([OTHER_ID]);
  });
});

describe("a browser-local deck read while signed in", () => {
  let client: QueryClient;
  let requested: string[];

  beforeEach(() => {
    requested = [];
    vi.stubGlobal("location", { origin: "http://localhost" });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Request) => {
        requested.push(new URL(input.url).pathname);
        return Promise.resolve(Response.json({ items: [] }));
      }),
    );
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    client.clear();
  });

  it("reads the local store without starting the server stores", async () => {
    const { createLocalDeck } = await import("@/features/decks/lib/local-decks-collection");
    const localId = createLocalDeck(WellKnown.deckFormat.CONSTRUCTED, "Poro Party");
    const { result } = renderHook(() => useDeckDetail(localId), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        createElement(
          QueryClientProvider,
          { client },
          createElement(Suspense, { fallback: null }, children),
        ),
    });

    await waitFor(() => {
      expect(result.current.data.deck.name).toBe("Poro Party");
    });
    expect(requested).toEqual([]);
  });
});
