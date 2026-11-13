import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/server-fns/api-error";

import { Route as DetailRoute } from "./$slug";
import { Route as EventsRoute } from "./$slug_.events";
import { Route as ShopsRoute } from "./$slug_.shops";

type Loader = (args: unknown) => Promise<unknown>;

function loaderArgs(query: (options: unknown) => Promise<unknown>) {
  return {
    context: { queryClient: { query: vi.fn(query) }, userId: "user-1" },
    location: { href: "/groups/playgroup" },
    params: { slug: "playgroup" },
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
