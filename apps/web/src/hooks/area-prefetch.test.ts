import { describe, expect, it, vi } from "vitest";

import { prefetchAreas } from "@/hooks/area-prefetch";
import { createQueryClient } from "@/lib/query-client";

vi.mock("@tanstack/react-start", () => ({
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

describe("prefetchAreas", () => {
  it("fetches the decks, folders, collections, lists and groups queries and preloads the copies store", () => {
    const queryClient = createQueryClient();
    const query = vi.spyOn(queryClient, "query").mockResolvedValue({ items: [] } as never);
    prefetchAreas(queryClient, "user-1");
    expect(query.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ["decks", "user-1"],
      ["deck-folders", "user-1"],
      ["collections", "user-1"],
      ["lists", "user-1"],
      ["lists", "user-1", "intent", "wish"],
      ["friend-groups", "user-1"],
    ]);
    expect(getCopiesCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(preloadCopies).toHaveBeenCalledTimes(1);
  });
});
