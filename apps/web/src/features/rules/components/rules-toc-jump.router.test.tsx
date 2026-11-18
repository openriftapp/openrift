import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useLocation,
} from "@tanstack/react-router";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

const nativeScrollIntoView = Element.prototype.scrollIntoView;

function RulesDocument() {
  const hash = useLocation({ select: (location) => location.hash });
  return (
    <main>
      <h2 id="rule-100">100. General</h2>
      {hash === "rule-100.1" && <p id="rule-100.1">100.1. Revealed by the hash</p>}
    </main>
  );
}

function mountRules() {
  const rootRoute = createRootRoute();
  const rules = createRoute({
    getParentRoute: () => rootRoute,
    path: "/rules/core",
    component: RulesDocument,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([rules]),
    history: createMemoryHistory({ initialEntries: ["/rules/core"] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  cleanup();
  Element.prototype.scrollIntoView = nativeScrollIntoView;
});

describe("router hash navigation the rules contents list awaits", () => {
  it("settles navigate() after the hash target rendered and was scrolled to", async () => {
    const events: string[] = [];
    Element.prototype.scrollIntoView = function recordScroll(this: Element) {
      events.push(`scroll ${this.id}`);
    };
    const router = mountRules();
    await screen.findByText("100. General");

    await act(async () => {
      await router.navigate({ to: ".", hash: "rule-100.1" });
      events.push(`settled at #${router.state.location.hash}`);
    });

    expect(events).toEqual(["scroll rule-100.1", "settled at #rule-100.1"]);
  });
});
