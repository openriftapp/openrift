import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as StaleBundleReload from "@/lib/stale-bundle-reload";

const reloadIfNewVersionPending = vi.fn<() => boolean>();
const forceReload = vi.fn<(reason: string) => void>();
let userId: string | null = null;

vi.mock("@/lib/stale-bundle-reload", async (importOriginal) => ({
  ...(await importOriginal<typeof StaleBundleReload>()),
  reloadIfNewVersionPending: () => reloadIfNewVersionPending(),
  forceReload: (reason: string) => forceReload(reason),
}));

vi.mock("@/hooks/use-session", () => ({ useUserId: () => userId }));

const { RouterErrorFallback } = await import("./error-fallback");
const { RouteErrorFallback } = await import("./error-message");

function statusError(status: number): Error {
  return Object.assign(new Error("request failed"), { status });
}

let crashing = false;

function Crash() {
  if (crashing) {
    throw new Error("thrown during render");
  }
  return <p>Crash page content</p>;
}

function renderApp({
  loader,
  rootBeforeLoad,
  entries = ["/page"],
  pageComponent = () => <p>Page content</p>,
}: {
  loader?: () => unknown;
  rootBeforeLoad?: () => void;
  entries?: string[];
  pageComponent?: () => ReactNode;
}) {
  const rootRoute = createRootRoute({
    beforeLoad: rootBeforeLoad,
    component: () => (
      <div>
        <p>Site header</p>
        <Outlet />
      </div>
    ),
  });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>Home content</p>,
  });
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/page",
    loader,
    component: pageComponent,
  });
  const crashRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/crash",
    component: Crash,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, pageRoute, crashRoute]),
    history: createMemoryHistory({ initialEntries: entries, initialIndex: entries.length - 1 }),
    defaultErrorComponent: RouterErrorFallback,
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe("RouterErrorFallback", () => {
  beforeEach(() => {
    reloadIfNewVersionPending.mockReturnValue(false);
    userId = null;
    crashing = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    forceReload.mockClear();
  });

  it("shows the failure copy inside the page shell", async () => {
    renderApp({
      loader: () => {
        throw statusError(500);
      },
    });

    expect(await screen.findByRole("heading", { name: "This page didn't load" })).toBeTruthy();
    expect(screen.getByText("Something went wrong on our side.")).toBeTruthy();
    expect(screen.getByText("Site header")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show details" })).toBeTruthy();
  });

  it("retries in place and shows the page once the loader succeeds", async () => {
    const loader = vi
      .fn()
      .mockImplementationOnce(() => {
        throw statusError(500);
      })
      .mockReturnValue(null);
    const reload = vi.spyOn(globalThis.location, "reload").mockImplementation(() => {});
    renderApp({ loader });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Page content")).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(forceReload).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("stays on the error with the same actions when the retry fails again", async () => {
    const loader = vi.fn(() => {
      throw statusError(500);
    });
    renderApp({ loader });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { name: "This page didn't load" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back" })).toBeTruthy();
  });

  it("recovers a render error on a route without a loader", async () => {
    crashing = true;
    renderApp({ entries: ["/crash"] });
    const user = userEvent.setup();
    const retry = await screen.findByRole("button", { name: "Try again" });
    crashing = false;

    await user.click(retry);

    expect(await screen.findByText("Crash page content")).toBeTruthy();
  });

  it("reloads the page for a chunk load error instead of retrying in place", async () => {
    const loader = vi.fn(() => {
      throw new TypeError("Failed to fetch dynamically imported module: /assets/page.js");
    });
    renderApp({ loader });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(forceReload).toHaveBeenCalledOnce();
    expect(loader).toHaveBeenCalledOnce();
  });

  it("shows the offline copy for a network failure, without details", async () => {
    renderApp({
      loader: () => {
        throw new TypeError("Failed to fetch");
      },
    });

    expect(await screen.findByRole("heading", { name: "You're offline" })).toBeTruthy();
    expect(screen.getByText("Can't reach the server. Check your connection.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
  });

  it("shows the offline copy when the browser reports offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderApp({
      loader: () => {
        throw statusError(500);
      },
    });

    expect(await screen.findByRole("heading", { name: "You're offline" })).toBeTruthy();
  });

  it("offers sign in for a 403 when signed out", async () => {
    renderApp({
      loader: () => {
        throw statusError(403);
      },
    });

    expect(
      await screen.findByRole("heading", { name: "You don't have access to this page" }),
    ).toBeTruthy();
    expect(screen.getByText("Sign in to check whether your account can open it.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      "/login?redirect=%2Fpage",
    );
    expect(screen.getByRole("link", { name: "Back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers only Back for a 403 when signed in", async () => {
    userId = "user-1";
    renderApp({
      loader: () => {
        throw statusError(403);
      },
    });

    expect(
      await screen.findByText("Your account doesn't have permission to open it."),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.getByRole("link", { name: "Back" })).toBeTruthy();
  });

  it("offers sign in for a 401 even while the cache still holds a user", async () => {
    userId = "user-1";
    renderApp({
      loader: () => {
        throw statusError(401);
      },
    });

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByText("Sign in to check whether your account can open it.")).toBeTruthy();
  });

  it("calls onRetry instead of invalidating the router outside a route boundary", async () => {
    const onRetry = vi.fn();
    const router = renderApp({
      pageComponent: () => <RouteErrorFallback error={statusError(500)} onRetry={onRetry} />,
    });
    const invalidate = vi.spyOn(router, "invalidate");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("goes back to the previous page when there is one", async () => {
    renderApp({
      entries: ["/", "/page"],
      loader: () => {
        throw statusError(500);
      },
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "Back" }));

    expect(await screen.findByText("Home content")).toBeTruthy();
  });

  it("links Back to the home page when there is no history", async () => {
    renderApp({
      loader: () => {
        throw statusError(500);
      },
    });

    const back = await screen.findByRole("link", { name: "Back" });
    expect(back.getAttribute("href")).toBe("/");
  });

  it("renders a page of its own when the root route fails", async () => {
    renderApp({
      rootBeforeLoad: () => {
        throw statusError(500);
      },
    });

    expect(await screen.findByRole("heading", { name: "This page didn't load" })).toBeTruthy();
    expect(screen.queryByText("Site header")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("reloads instead of rendering the error page when a new version is pending", async () => {
    reloadIfNewVersionPending.mockReturnValue(true);
    renderApp({
      loader: () => {
        throw statusError(500);
      },
    });

    await vi.waitFor(() => expect(reloadIfNewVersionPending).toHaveBeenCalled());
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
