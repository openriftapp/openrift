import { QueryClient } from "@tanstack/react-query";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it } from "vitest";

import { requireSession } from "@/lib/auth-session";

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
