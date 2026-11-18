import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListEntry } from "@/features/catalog-workspace/lib/owner-items";

const queue = vi.hoisted(() => ({ entries: [] as ListEntry[] }));

vi.mock("@/features/catalog-workspace/hooks/use-workspace-queue", () => ({
  useWorkspaceEntries: () => ({ view: "open", listAllowed: true, entries: queue.entries }),
}));

const { useQueueNavigation } = await import("./use-queue-navigation");

function cardEntry(cardSlug: string): ListEntry {
  return {
    key: `card:${cardSlug}`,
    title: cardSlug,
    detail: "",
    target: { kind: "card", cardSlug },
  };
}

function newCardEntry(name: string): ListEntry {
  return { key: `card-new:${name}`, title: name, detail: "", target: { kind: "card-new", name } };
}

function Record() {
  const { goNext } = useQueueNavigation("card");
  return (
    <button type="button" onClick={goNext}>
      Next
    </button>
  );
}

function OwnerList() {
  return <Outlet />;
}

function mountWorkspace(entry: string, slowLoad: Promise<void>) {
  const rootRoute = createRootRoute();
  const cards = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin/workspace/cards",
    component: OwnerList,
  });
  const card = createRoute({
    getParentRoute: () => cards,
    path: "$cardSlug",
    loader: ({ params }) => (params.cardSlug === "slow" ? slowLoad : undefined),
    component: Record,
  });
  const newCard = createRoute({
    getParentRoute: () => cards,
    path: "new/$name",
    component: Record,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([cards.addChildren([card, newCard])]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
});

describe("useQueueNavigation with a real router", () => {
  it("steps to the next record from the one on screen", async () => {
    queue.entries = [newCardEntry("ahri nine tailed fox"), cardEntry("yasuo-unforgiven")];
    const router = mountWorkspace(
      "/admin/workspace/cards/new/ahri%20nine%20tailed%20fox",
      new Promise(() => {}),
    );
    await waitFor(() => expect(router.state.status).toBe("idle"));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/admin/workspace/cards/yasuo-unforgiven"),
    );
  });

  it("does not step while the admin's move to another record is still loading", async () => {
    queue.entries = [cardEntry("jinx-loose-cannon"), cardEntry("yasuo-unforgiven")];
    let finishLoad: () => void = () => {};
    const slowLoad = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    const router = mountWorkspace("/admin/workspace/cards/jinx-loose-cannon", slowLoad);
    await waitFor(() => expect(router.state.status).toBe("idle"));

    void router.navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug: "slow" } });
    await waitFor(() => expect(router.state.status).toBe("pending"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    finishLoad();

    await waitFor(() => expect(router.state.status).toBe("idle"));
    expect(router.state.location.pathname).toBe("/admin/workspace/cards/slow");
  });
});
