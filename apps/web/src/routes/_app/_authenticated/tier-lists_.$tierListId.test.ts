import { readFileSync } from "node:fs";
import path from "node:path";

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const { fetchTierList } = vi.hoisted(() => ({
  fetchTierList: vi.fn(() => Promise.resolve({ id: "list-1", tiers: [{ label: "S", cards: [] }] })),
}));

vi.mock("@/features/stage/lib/tier-lists-queries", () => ({
  tierListQueryOptions: (userId: string, id: string) => ({
    queryKey: ["tier-lists", userId, id],
    queryFn: fetchTierList,
  }),
}));

const { Route } = await import("./tier-lists_.$tierListId");
const { TIER_LIST_SAVE_MUTATION_KEY } = await import("@/features/stage/lib/tier-list-saves");

type LoaderFn = (ctx: {
  context: { queryClient: QueryClient; userId: string };
  params: { tierListId: string };
}) => Promise<void>;

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: Record<string, unknown>) => Record<string, unknown>;
};

describe("/tier-lists/$tierListId filter search", () => {
  it("validates the shared filter search params", () => {
    expect(validateSearch.parse({ q: "ekko", sets: ["ogn"], sort: "name" })).toMatchObject({
      q: "ekko",
      sets: ["ogn"],
      sort: "name",
    });
  });

  it("drops unknown search params", () => {
    expect(validateSearch.parse({ nonsense: "x" })).not.toHaveProperty("nonsense");
  });

  it("wraps the builder in a FilterSearchProvider", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "./tier-lists_.$tierListId.lazy.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/<FilterSearchProvider value=\{search\}>/u);
  });
});

describe("/tier-lists/$tierListId loader", () => {
  it("fetches the list even when the cache already holds it", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["tier-lists", "user-1", "list-1"], { id: "list-1", tiers: [] });

    await (Route.options.loader as unknown as LoaderFn)({
      context: { queryClient, userId: "user-1" },
      params: { tierListId: "list-1" },
    });

    expect(fetchTierList).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["tier-lists", "user-1", "list-1"])).toEqual({
      id: "list-1",
      tiers: [{ label: "S", cards: [] }],
    });
  });

  it("reads the list only after a save from the stage has landed", async () => {
    fetchTierList.mockClear();
    const queryClient = new QueryClient();
    let finishSave: () => void = () => {};
    const saved = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const save = queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: [...TIER_LIST_SAVE_MUTATION_KEY],
        mutationFn: () => saved,
      })
      .execute({ id: "list-1" });

    const loading = (Route.options.loader as unknown as LoaderFn)({
      context: { queryClient, userId: "user-1" },
      params: { tierListId: "list-1" },
    });
    await Promise.resolve();
    expect(fetchTierList).not.toHaveBeenCalled();

    finishSave();
    await save;
    await loading;
    expect(fetchTierList).toHaveBeenCalledOnce();
  });

  it("does not let a hover preload stand in for the fetch on entry", () => {
    expect(Route.options.preloadStaleTime).toBe(0);
  });
});
