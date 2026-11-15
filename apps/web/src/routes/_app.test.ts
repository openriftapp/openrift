import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { Route } from "./_app";

type Hook = (ctx: Record<string, unknown>) => Promise<unknown>;
const appGate = Route.options.beforeLoad as unknown as Hook;

function location(pathname: string, search: Record<string, unknown>, href: string) {
  return { pathname, search, href };
}

describe("the app layout on the server", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it("sends a signed-out visitor of an owned stage tier list to sign in", async () => {
    queryClient.setQueryData(["session"], null);

    const thrown: unknown = await appGate({
      context: { queryClient },
      location: location("/stage", { tier: "list-1" }, "/stage?tier=list-1&i=2"),
    }).catch((error: unknown) => error);

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: { to: "/login", search: { redirect: "/stage?tier=list-1&i=2" } },
    });
  });

  it("lets a signed-in owner through to the stage", async () => {
    queryClient.setQueryData(["session"], { user: { id: "user-1" } });

    await expect(
      appGate({
        context: { queryClient },
        location: location("/stage", { tier: "list-1" }, "/stage?tier=list-1"),
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a shared ranking", "/stage", { tierShare: "tok" }],
    ["a deck walk", "/stage", { deck: "deck-1" }],
    ["a numeric tier the stage ignores", "/stage", { tier: 12 }],
    ["another page with a tier param", "/cards", { tier: "list-1" }],
  ])("leaves %s public", async (_label, pathname, search) => {
    queryClient.setQueryData(["session"], null);

    await expect(
      appGate({ context: { queryClient }, location: location(pathname, search, pathname) }),
    ).resolves.toBeUndefined();
  });
});
