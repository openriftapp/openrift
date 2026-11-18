import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/server-fns/api-error";

import { Route } from "./stage_.show";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: Record<string, unknown>) => Record<string, unknown>;
};

type SessionUser = { user: { id: string } } | null;

const beforeLoad = Route.options.beforeLoad as unknown as (args: {
  context: { queryClient: { query: () => Promise<SessionUser> } };
  location: { href: string };
  search: Record<string, unknown>;
}) => Promise<void>;

function runGuard(search: Record<string, unknown>, session: SessionUser, href = "/stage/show") {
  const query = vi.fn().mockResolvedValue(session);
  return {
    query,
    result: beforeLoad({
      context: { queryClient: { query } },
      location: { href },
      search,
    }),
  };
}

describe("/stage/show mode", () => {
  it("accepts the edit mode", () => {
    expect(validateSearch.parse({ tier: "list-1", mode: "edit" })).toMatchObject({
      tier: "list-1",
      mode: "edit",
    });
  });

  it("presents when no mode is given", () => {
    expect(validateSearch.parse({ tier: "list-1" }).mode).toBeUndefined();
  });

  it.each(["rank", "nonsense", ""])(
    "falls back to presenting for %o (rank is the old mode value)",
    (mode) => {
      expect(validateSearch.parse({ tier: "list-1", mode }).mode).toBeUndefined();
    },
  );
});

// `?tier=` resolves through useRequiredUserId, which throws without a session;
// the stage itself is public, so the guard gates that one param, not the route.
describe("/stage/show owned tier-list guard", () => {
  it("redirects a signed-out visitor to sign in", async () => {
    const { result } = runGuard({ tier: "list-1" }, null);

    await expect(result).rejects.toSatisfy(isRedirect);
  });

  it("returns to the stage URL after signing in", async () => {
    const { result } = runGuard({ tier: "list-1" }, null, "/stage/show?tier=list-1&i=4&preset=p-1");

    const thrown: unknown = await result.catch((error: unknown) => error);

    expect(thrown).toMatchObject({
      options: {
        to: "/login",
        search: { redirect: "/stage/show?tier=list-1&i=4&preset=p-1" },
      },
    });
  });

  it("lets the owner through", async () => {
    const { result } = runGuard({ tier: "list-1" }, { user: { id: "user-1" } });

    await expect(result).resolves.toBeUndefined();
  });

  it("leaves the shared-ranking branch public", async () => {
    const { query, result } = runGuard({ tierShare: "tok" }, null);

    await expect(result).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    ["a deck walk", { deck: "deck-1" }],
    ["an ad-hoc queue", { cards: ["p-1", "p-2"] }],
  ])("leaves %s public", async (_label, search) => {
    const { query, result } = runGuard(search, null);

    await expect(result).resolves.toBeUndefined();
    expect(query).not.toHaveBeenCalled();
  });
});

const loader = Route.options.loader as unknown as (args: {
  context: {
    queryClient: {
      query: (options: { queryKey: readonly unknown[] }) => Promise<unknown>;
      getMutationCache: () => { findAll: () => [] };
    };
  };
  deps: { deck?: string; tier?: string };
}) => Promise<unknown>;

function runLoader(tier: Promise<unknown>) {
  const query = vi.fn((options: { queryKey: readonly unknown[] }) =>
    options.queryKey[0] === "tier-lists" ? tier : Promise.resolve({ user: { id: "user-1" } }),
  );
  return {
    query,
    result: loader({
      context: { queryClient: { query, getMutationCache: () => ({ findAll: () => [] }) } },
      deps: { tier: "list-1" },
    }),
  };
}

describe("/stage/show owned tier-list loader", () => {
  it("shows the not-found page for a list the API does not have", async () => {
    const { result } = runLoader(Promise.reject(notFoundError()));

    expect(isNotFound(await result.catch((error: unknown) => error))).toBe(true);
    expect(Route.options.notFoundComponent).toBeDefined();
  });

  it("fetches the owner's list under their id even when the cache holds it", async () => {
    const { query, result } = runLoader(Promise.resolve({ id: "list-1", tiers: [] }));

    await expect(result).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["tier-lists", "user-1", "list-1"],
        staleTime: 0,
      }),
    );
  });

  it("does not let a hover preload stand in for the fetch on entry", () => {
    expect(Route.options.preloadStaleTime).toBe(0);
  });
});

describe("/stage/show chrome", () => {
  it("asks the root shell to drop the app frame", () => {
    expect(Route.options.staticData).toMatchObject({ chrome: "bare" });
  });

  it("paints the dark stand-in while it loads", () => {
    expect(Route.options.pendingComponent).toBeDefined();
  });
});
