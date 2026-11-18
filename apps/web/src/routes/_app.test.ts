import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireSession } from "@/lib/auth-session";

import { Route } from "./_app";

type Hook = (ctx: Record<string, unknown>) => Promise<unknown>;
const appGate = Route.options.beforeLoad as unknown as Hook;

function location(pathname: string, search: Record<string, unknown>, href: string) {
  const query = href.indexOf("?");
  return { pathname, search, href, searchStr: query === -1 ? "" : href.slice(query) };
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
      location: location("/stage/show", { tier: "list-1" }, "/stage/show?tier=list-1&i=2"),
    }).catch((error: unknown) => error);

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: { to: "/login", search: { redirect: "/stage/show?tier=list-1&i=2" } },
    });
  });

  it("lets a signed-in owner through to the stage", async () => {
    queryClient.setQueryData(["session"], { user: { id: "user-1" } });

    await expect(
      appGate({
        context: { queryClient },
        location: location("/stage/show", { tier: "list-1" }, "/stage/show?tier=list-1"),
      }),
    ).resolves.toBeUndefined();
  });

  it("leaves a stage tier list to its own gate when the session lookup fails", async () => {
    vi.spyOn(queryClient, "query").mockRejectedValue(new Error("session API down"));

    await expect(
      appGate({
        context: { queryClient },
        location: location("/stage/show", { tier: "list-1" }, "/stage/show?tier=list-1"),
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["a shared ranking", "/stage/show", { tierShare: "tok" }],
    ["a deck walk", "/stage/show", { deck: "deck-1" }],
    ["a numeric tier the stage ignores", "/stage/show", { tier: 12, deck: "deck-1" }],
    ["another page with a tier param", "/cards", { tier: "list-1" }],
  ])("leaves %s public", async (_label, pathname, search) => {
    queryClient.setQueryData(["session"], null);

    await expect(
      appGate({ context: { queryClient }, location: location(pathname, search, pathname) }),
    ).resolves.toBeUndefined();
  });
});

describe("stage URLs that name the other half", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["session"], null);

  it.each([
    ["a deck walk", { deck: "deck-1" }, "?deck=deck-1&i=3"],
    ["an owned ranking", { tier: "list-1" }, "?tier=list-1&preset=p-1"],
    ["a shared ranking", { tierShare: "tok" }, "?tierShare=tok"],
    ["a presented queue", { cards: ["p-1", "p-2"] }, "?cards=x"],
    ["a deck walk marked as a draft", { deck: "deck-1", edit: true }, "?deck=deck-1&edit=true"],
  ])("sends /stage with %s to the show, keeping the search", async (_label, search, searchStr) => {
    const thrown: unknown = await appGate({
      context: { queryClient },
      location: location("/stage", search, `/stage${searchStr}`),
    }).catch((error: unknown) => error);

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({ options: { href: `/stage/show${searchStr}`, replace: true } });
  });

  it.each([
    ["no queue", {}],
    ["a queue draft", { cards: ["p-1"], edit: true }],
    ["an empty queue", { cards: [] }],
  ])("leaves /stage with %s on the builder", async (_label, search) => {
    await expect(
      appGate({ context: { queryClient }, location: location("/stage", search, "/stage") }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["nothing to present", {}],
    ["a queue the show cannot read", { cards: [1, 2] }],
  ])("sends /stage/show with %s to the builder", async (_label, search) => {
    const thrown: unknown = await appGate({
      context: { queryClient },
      location: location("/stage/show", search, "/stage/show?q=ekko"),
    }).catch((error: unknown) => error);

    expect(thrown).toMatchObject({ options: { href: "/stage?q=ekko", replace: true } });
  });
});

describe("a URL carrying a natively submitted secret", () => {
  it("ends a signed-out visit to a leaked profile URL on a clean sign-in URL", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], null);
    const leaked = "/profile?currentPassword=x&newPassword=y&confirmPassword=y";

    const first: unknown = await appGate({
      context: { queryClient },
      location: location("/profile", {}, leaked),
    }).catch((error: unknown) => error);
    expect(isRedirect(first)).toBe(true);
    expect(first).toMatchObject({ options: { href: "/profile", replace: true } });

    const second: unknown = await requireSession({
      context: { queryClient },
      location: { href: (first as { options: { href: string } }).options.href },
    }).catch((error: unknown) => error);
    expect(second).toMatchObject({
      options: { to: "/login", search: { redirect: "/profile" } },
    });
    expect(JSON.stringify([first, second])).not.toMatch(/Password|=x|=y/u);
  });

  it.each(["/login", "/signup", "/reset-password", "/verify-email", "/cards"])(
    "%s redirects to the path without the form fields",
    async (pathname) => {
      const queryClient = new QueryClient();
      const thrown: unknown = await appGate({
        context: { queryClient },
        location: location(pathname, {}, `${pathname}?email=vi%40example.com&password=hextech`),
      }).catch((error: unknown) => error);

      expect(thrown).toMatchObject({ options: { href: pathname } });
    },
  );

  it.each(["/.//evil.com?password=x", "/%2e//evil.com?password=x"])(
    "redirects %s to a local path",
    async (href) => {
      const queryClient = new QueryClient();
      const thrown: unknown = await appGate({
        context: { queryClient },
        location: location("/evil.com", {}, href),
      }).catch((error: unknown) => error);

      expect(thrown).toMatchObject({ options: { href: "/", replace: true } });
    },
  );

  it("cleans a secret inside a redirect target", async () => {
    const queryClient = new QueryClient();
    const nested = encodeURIComponent("/profile?currentPassword=x&tab=security");
    const thrown: unknown = await appGate({
      context: { queryClient },
      location: location("/login", {}, `/login?redirect=${nested}`),
    }).catch((error: unknown) => error);

    expect(thrown).toMatchObject({
      options: { href: `/login?redirect=${encodeURIComponent("/profile?tab=security")}` },
    });
  });
});
