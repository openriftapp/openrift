import { isNotFound, isRedirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/server-fns/api-error";

import { Route as DetailRoute } from "./$slug";
import { Route as SharedCollectionRoute } from "./$slug_.collections.$collectionId";
import { Route as EventsRoute } from "./$slug_.events";
import { Route as SharedListRoute } from "./$slug_.lists.$listId";
import { Route as MemberRoute } from "./$slug_.members_.$userId";
import { Route as ShopsRoute } from "./$slug_.shops";

type Loader = (args: unknown) => Promise<unknown>;

function loaderArgs(query: (options: unknown) => Promise<unknown>) {
  return {
    context: { queryClient: { query: vi.fn(query) }, userId: "user-1" },
    location: { href: "/groups/playgroup" },
    params: { slug: "playgroup", userId: "user-2", listId: "list-1", collectionId: "col-1" },
  };
}

async function thrownBy(loader: Loader, args: unknown): Promise<unknown> {
  try {
    await loader(args);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("group routes for a group the viewer cannot see", () => {
  it.each([
    ["detail", DetailRoute],
    ["events", EventsRoute],
    ["shops", ShopsRoute],
    ["member", MemberRoute],
    ["shared list", SharedListRoute],
    ["shared collection", SharedCollectionRoute],
  ])("answer the %s page with the router's not-found", async (_name, route) => {
    const loader = route.options.loader as unknown as Loader;
    const thrown = await thrownBy(
      loader,
      loaderArgs(() => Promise.reject(notFoundError())),
    );
    expect(isNotFound(thrown)).toBe(true);
  });

  it("keeps any other API failure an error", async () => {
    const loader = DetailRoute.options.loader as unknown as Loader;
    const failure = Object.assign(new Error("boom"), { status: 500 });
    const thrown = await thrownBy(
      loader,
      loaderArgs(() => Promise.reject(failure)),
    );
    expect(thrown).toBe(failure);
  });
});

describe("group pages for a member, shared list or collection that is gone", () => {
  it.each([
    ["member", MemberRoute],
    ["shared list", SharedListRoute],
    ["shared collection", SharedCollectionRoute],
  ])("answer the %s page with the router's not-found", async (_name, route) => {
    const loader = route.options.loader as unknown as Loader;
    const thrown = await thrownBy(
      loader,
      loaderArgs((options) =>
        (options as { queryKey: readonly unknown[] }).queryKey.length > 3
          ? Promise.reject(notFoundError())
          : Promise.resolve({ group: { slug: "playgroup" } }),
      ),
    );
    expect(isNotFound(thrown)).toBe(true);
  });
});

describe("group pages under a renamed slug", () => {
  it.each([
    ["member", MemberRoute],
    ["shared list", SharedListRoute],
    ["shared collection", SharedCollectionRoute],
  ])("send the %s page to the current slug", async (_name, route) => {
    const loader = route.options.loader as unknown as Loader;
    const thrown = await thrownBy(
      loader,
      loaderArgs(() => Promise.resolve({ group: { slug: "renamed" } })),
    );
    expect(isRedirect(thrown)).toBe(true);
  });
});
