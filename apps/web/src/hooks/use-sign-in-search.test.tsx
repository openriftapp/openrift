import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { hrefWithoutHash, useSignInSearch } from "./use-sign-in-search";

function SignInLink() {
  const signIn = useSignInSearch();
  return <Link {...signIn}>Sign in</Link>;
}

async function signInHref(entry: string): Promise<string | null> {
  const rootRoute = createRootRoute({ component: SignInLink });
  const routeTree = rootRoute.addChildren([
    createRoute({ getParentRoute: () => rootRoute, path: "/cards" }),
    createRoute({ getParentRoute: () => rootRoute, path: "/login" }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(<RouterProvider router={router} />);
  const link = await screen.findByRole("link", { name: "Sign in" });
  const href = link.getAttribute("href");
  cleanup();
  return href;
}

afterEach(() => {
  cleanup();
});

describe("useSignInSearch", () => {
  it("links to /login with the current page as the redirect", async () => {
    expect(await signInHref("/cards?q=vi")).toBe(
      `/login?redirect=${encodeURIComponent("/cards?q=vi")}`,
    );
  });

  it("renders the same href with and without a hash, as the server never sees one", async () => {
    expect(await signInHref("/cards?q=vi#x")).toBe(await signInHref("/cards?q=vi"));
  });
});

describe("hrefWithoutHash", () => {
  it("cuts the href at the hash", () => {
    expect(hrefWithoutHash("/rules/core/2026-10-09?lang=en#rule-107")).toBe(
      "/rules/core/2026-10-09?lang=en",
    );
  });

  it("keeps an href without a hash unchanged", () => {
    expect(hrefWithoutHash("/cards")).toBe("/cards");
  });
});
