import type { AnyRouter, ParsedLocation } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { shouldRestoreScroll, trackScrollRestorationSource } from "./scroll-restoration";

function location(href: string, state: Record<string, unknown> = {}): ParsedLocation {
  return { href, state } as unknown as ParsedLocation;
}

function routerStub() {
  let onBeforeLoad: ((event: { fromLocation?: ParsedLocation }) => void) | undefined;
  const router = {
    subscribe: (_event: string, fn: typeof onBeforeLoad) => {
      onBeforeLoad = fn;
      return () => {};
    },
  } as unknown as AnyRouter;
  trackScrollRestorationSource(router);
  return (fromLocation?: ParsedLocation) => onBeforeLoad?.({ fromLocation });
}

describe("shouldRestoreScroll", () => {
  it("restores on the first load", () => {
    const load = routerStub();
    load();

    expect(shouldRestoreScroll({ location: location("/cards") })).toBe(true);
  });

  it("restores on a navigation between pages", () => {
    const load = routerStub();
    load(location("/cards"));

    expect(shouldRestoreScroll({ location: location("/decks") })).toBe(true);
  });

  it("restores when opening an overlay over the page", () => {
    const load = routerStub();
    load(location("/cards"));

    expect(
      shouldRestoreScroll({
        location: location("/cards", { cardDetail: true, overlayEntry: true }),
      }),
    ).toBe(true);
  });

  it("keeps the scroll when an overlay entry is popped back to the page under it", () => {
    const load = routerStub();
    load(location("/cards", { cardDetail: true, overlayEntry: true }));

    expect(shouldRestoreScroll({ location: location("/cards") })).toBe(false);
  });

  it("restores when leaving an overlay entry for another page", () => {
    const load = routerStub();
    load(location("/cards", { cardDetail: true, overlayEntry: true }));

    expect(shouldRestoreScroll({ location: location("/cards/annie-fiery") })).toBe(true);
  });
});
