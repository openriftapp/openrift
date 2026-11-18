import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/command-palette/command-palette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/layout/app-background", () => ({ AppBackground: () => null }));
vi.mock("@/components/layout/footer", () => ({ Footer: () => <footer>Footer</footer> }));
vi.mock("@/components/layout/header", () => ({ Header: () => <header>Header</header> }));
vi.mock("@/components/layout/site-banner", () => ({ SiteBanner: () => null }));
vi.mock("@/features/account/hooks/use-preferences-sync", () => ({ usePreferencesSync: vi.fn() }));
vi.mock("@/features/groups/components/trade-cancel-consent-host", () => ({
  TradeCancelConsentHost: () => null,
}));
vi.mock("@/hooks/use-idle-area-prefetch", () => ({ useIdleAreaPrefetch: vi.fn() }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));
vi.mock("@/lib/report-error", () => ({ setSentryUser: vi.fn() }));

const { AppLayout } = await import("./app-layout");

const mounts = vi.fn();

function Page() {
  useEffect(() => {
    mounts();
  }, []);
  return <p>Page</p>;
}

function mountLayout() {
  const rootRoute = createRootRoute({ component: AppLayout });
  let loads = 0;
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: "/scan",
    beforeLoad: () => Promise.resolve(),
    loader: () => {
      loads += 1;
      return loads === 1 ? Promise.resolve() : new Promise<void>(() => {});
    },
    pendingComponent: () => <p>Loading</p>,
    pendingMs: 0,
    component: Page,
  });
  const bare = createRoute({
    getParentRoute: () => page,
    path: "camera",
    staticData: { chrome: "bare" },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page.addChildren([bare])]),
    history: createMemoryHistory({ initialEntries: ["/scan"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  mounts.mockClear();
});

describe("AppLayout", () => {
  it("drops the app frame for a bare child route without remounting the page", async () => {
    const router = mountLayout();
    await screen.findByText("Page");
    expect(screen.getByText("Header")).toBeInTheDocument();

    await router.navigate({ to: "/scan/camera" });
    await waitFor(() => expect(screen.queryByText("Header")).toBeNull());
    expect(screen.queryByText("Footer")).toBeNull();

    await router.navigate({ to: "/scan" });
    await screen.findByText("Header");

    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(mounts).toHaveBeenCalledOnce();
  });
});
