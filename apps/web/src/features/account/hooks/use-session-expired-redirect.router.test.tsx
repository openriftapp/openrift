import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => {
  let data: unknown;
  const listeners = new Set<() => void>();
  return {
    get: () => data,
    set: (next: unknown) => {
      data = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: useSyncExternalStore(session.subscribe, session.get) }),
}));

const { useSessionExpiredRedirect } = await import("./use-session-expired-redirect");

function AuthenticatedLayout() {
  useSessionExpiredRedirect();
  return <Outlet />;
}

function mountApp(entry: string, publicLoad: Promise<void> = Promise.resolve()) {
  const rootRoute = createRootRoute();
  const app = createRoute({ getParentRoute: () => rootRoute, id: "_app", component: Outlet });
  const authenticated = createRoute({
    getParentRoute: () => app,
    id: "_authenticated",
    component: AuthenticatedLayout,
  });
  const deck = createRoute({
    getParentRoute: () => authenticated,
    path: "decks/$deckId",
    component: () => <p>Deck page</p>,
  });
  const cards = createRoute({
    getParentRoute: () => app,
    path: "cards",
    loader: () => publicLoad,
    component: () => <p>Cards page</p>,
  });
  const login = createRoute({
    getParentRoute: () => app,
    path: "login",
    component: () => <p>Login page</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      app.addChildren([authenticated.addChildren([deck]), cards, login]),
    ]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  session.set(undefined);
});

describe("useSessionExpiredRedirect with a real router", () => {
  it("stays on the page while the session has not resolved", async () => {
    const router = mountApp("/decks/abc");

    await screen.findByText("Deck page");
    expect(router.state.location.pathname).toBe("/decks/abc");
  });

  it("stays on the page for a signed-in user", async () => {
    session.set({ user: { id: "user-1" } });
    const router = mountApp("/decks/abc");

    await screen.findByText("Deck page");
    expect(router.state.location.pathname).toBe("/decks/abc");
  });

  it("sends an expired session to /login with the page it was on", async () => {
    session.set({ user: { id: "user-1" } });
    const router = mountApp("/decks/abc?view=list");
    await screen.findByText("Deck page");

    act(() => session.set(null));

    await screen.findByText("Login page");
    expect(router.state.location.search).toEqual({ redirect: "/decks/abc?view=list" });
  });

  it("lets a navigation out to a public page finish when the session ends during it", async () => {
    session.set({ user: { id: "user-1" } });
    let finishLoad = () => {};
    const publicLoad = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    const router = mountApp("/decks/abc", publicLoad);
    await screen.findByText("Deck page");

    let leaving: Promise<void> | undefined;
    act(() => {
      leaving = router.navigate({ to: "/cards" });
    });
    await waitFor(() => expect(router.state.location.pathname).toBe("/cards"));
    expect(screen.getByText("Deck page")).toBeInTheDocument();
    act(() => session.set(null));
    finishLoad();
    await act(() => leaving);

    await screen.findByText("Cards page");
    expect(router.state.location.pathname).toBe("/cards");
    expect(router.history.length).toBe(2);
  });
});
