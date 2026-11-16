import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route } from "./route";

type Hook = (ctx: Record<string, unknown>) => unknown;
const decksGate = Route.options.beforeLoad as unknown as Hook;

function run(pathname: string, search: Record<string, unknown>): unknown {
  try {
    return decksGate({ location: { pathname, search } });
  } catch (error: unknown) {
    return error;
  }
}

describe("the decks layout", () => {
  it("sends an old comparison link to the same decks without the retired prefix", () => {
    const thrown = run("/decks/compare", { from: "local:deck-1", to: "share:abc" });

    expect(isRedirect(thrown)).toBe(true);
    expect(thrown).toMatchObject({
      options: {
        to: "/decks/compare",
        search: { from: "deck-1", to: "share:abc" },
        replace: true,
      },
    });
  });

  it("keeps a side the router parsed as a number while stripping the other", () => {
    const thrown = run("/decks/compare", { from: 123, to: "local:deck-2" });

    expect(thrown).toMatchObject({ options: { search: { from: "123", to: "deck-2" } } });
  });

  it("drops a side that is neither text nor a number", () => {
    const thrown = run("/decks/compare", { from: { a: 1 }, to: "local:deck-2" });

    expect(thrown).toMatchObject({ options: { search: { from: undefined, to: "deck-2" } } });
  });

  it.each([
    ["a current comparison link", "/decks/compare", { from: "deck-1", to: "meta:x" }],
    ["a comparison with no sides", "/decks/compare", {}],
    ["a comparison whose only odd side is not a string", "/decks/compare", { from: 3 }],
    ["another deck page", "/decks/local:deck-1", { from: "local:deck-1" }],
  ])("lets %s through", (_label, pathname, search) => {
    expect(run(pathname, search)).toBeUndefined();
  });
});
