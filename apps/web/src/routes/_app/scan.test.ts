import type { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionQueryOptions } from "@/lib/auth-session";
import { featureFlagsQueryOptions } from "@/lib/feature-flags";

const { getCollectionsCollection, preload } = vi.hoisted(() => {
  const preloadFn = vi.fn(() => Promise.resolve());
  return {
    preload: preloadFn,
    getCollectionsCollection: vi.fn(() => ({ preload: preloadFn })),
  };
});

vi.mock("@/features/collections/lib/collections-collection", () => ({
  getCollectionsCollection,
}));

vi.mock("@/features/cards/lib/catalog-queries", () => ({
  catalogQueryOptions: { queryKey: ["catalog"] },
  loadCatalogTail: vi.fn(() => Promise.resolve()),
}));

const { Route } = await import("./scan");

type Hook = (ctx: { context: { queryClient: QueryClient } }) => Promise<unknown>;

function clientFor({
  session,
  scanner = true,
}: {
  session: { user: { id: string } } | null;
  scanner?: boolean;
}): QueryClient {
  const query = vi.fn(({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === sessionQueryOptions().queryKey[0]) {
      return Promise.resolve(session);
    }
    if (queryKey[0] === featureFlagsQueryOptions.queryKey[0]) {
      return Promise.resolve({ scanner });
    }
    return Promise.resolve(undefined);
  });
  return { query } as unknown as QueryClient;
}

function runBeforeLoad(queryClient: QueryClient): Promise<unknown> {
  return (Route.options.beforeLoad as unknown as Hook)({ context: { queryClient } });
}

function runLoader(queryClient: QueryClient): Promise<unknown> {
  return (Route.options.loader as unknown as Hook)({ context: { queryClient } });
}

describe("/scan route", () => {
  beforeEach(() => {
    getCollectionsCollection.mockClear();
    preload.mockClear();
  });

  it("opens for a signed-out visitor while the scanner is available", async () => {
    await expect(runBeforeLoad(clientFor({ session: null }))).resolves.toBeUndefined();
  });

  it("still redirects away when the scanner is unavailable", async () => {
    await expect(runBeforeLoad(clientFor({ session: null, scanner: false }))).rejects.toSatisfy(
      (value: unknown) => isRedirect(value),
    );
  });

  it("loads without touching the collections for a signed-out visitor", async () => {
    await runLoader(clientFor({ session: null }));

    expect(getCollectionsCollection).not.toHaveBeenCalled();
  });

  it("preloads the signed-in user's collections", async () => {
    const queryClient = clientFor({ session: { user: { id: "user-1" } } });

    await runLoader(queryClient);

    expect(getCollectionsCollection).toHaveBeenCalledWith(queryClient, "user-1");
    expect(preload).toHaveBeenCalledOnce();
  });
});
