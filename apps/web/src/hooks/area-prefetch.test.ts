import { describe, expect, it, vi } from "vitest";

import { prefetchAreas } from "@/hooks/area-prefetch";
import { createQueryClient } from "@/lib/query-client";

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createServerFn: () => {
    const chain = {
      handler: () => () => Promise.resolve({ items: [] }),
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

const { preloadCopies, getCopiesCollection } = vi.hoisted(() => {
  const preload = vi.fn(() => Promise.resolve());
  return { preloadCopies: preload, getCopiesCollection: vi.fn(() => ({ preload })) };
});
vi.mock("@/features/collections/lib/copies-collection", () => ({ getCopiesCollection }));

const { preloadCollections, getCollectionsCollection } = vi.hoisted(() => {
  const preload = vi.fn(() => Promise.resolve());
  return { preloadCollections: preload, getCollectionsCollection: vi.fn(() => ({ preload })) };
});
vi.mock("@/features/collections/lib/collections-collection", () => ({ getCollectionsCollection }));

const { preloadDecks, getDecksCollection, getDeckCardsCollection, getDeckFoldersCollection } =
  vi.hoisted(() => {
    const preload = vi.fn(() => Promise.resolve());
    return {
      preloadDecks: preload,
      getDecksCollection: vi.fn(() => ({ preload })),
      getDeckCardsCollection: vi.fn(() => ({ preload })),
      getDeckFoldersCollection: vi.fn(() => ({ preload })),
    };
  });
vi.mock("@/features/decks/lib/decks-collection", () => ({
  getDecksCollection,
  getDeckCardsCollection,
  getDeckFoldersCollection,
}));

describe("prefetchAreas", () => {
  it("fetches the list and group queries and preloads the deck, collection and copy stores", () => {
    const queryClient = createQueryClient();
    const query = vi.spyOn(queryClient, "query").mockResolvedValue({ items: [] } as never);

    prefetchAreas(queryClient, "user-1");

    expect(query.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ["lists", "user-1"],
      ["lists", "user-1", "intent", "wish"],
      ["friend-groups", "user-1"],
    ]);
    expect(getDecksCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(getDeckCardsCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(getDeckFoldersCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(getCollectionsCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(getCopiesCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(preloadDecks).toHaveBeenCalledTimes(3);
    expect(preloadCollections).toHaveBeenCalledTimes(1);
    expect(preloadCopies).toHaveBeenCalledTimes(1);
  });
});
