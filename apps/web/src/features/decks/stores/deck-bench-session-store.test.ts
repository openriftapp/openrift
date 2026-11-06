import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { EMPTY_BENCH_SESSION, useDeckBenchSessionStore } from "./deck-bench-session-store";

const resetStore = createStoreResetter(useDeckBenchSessionStore);

beforeEach(resetStore);
afterEach(resetStore);

const hand = {
  hand: [{ key: "a-0", cardId: "a", cardName: "A", preferredPrintingId: null }],
  library: [],
  mulliganUsed: false,
  hasDrawn: false,
};

describe("deck bench session store", () => {
  it("starts empty", () => {
    expect(useDeckBenchSessionStore.getState().byDeck).toEqual({});
  });

  it("patches one field and fills the rest from the empty session", () => {
    useDeckBenchSessionStore.getState().patch("deck-1", { bench: hand });
    expect(useDeckBenchSessionStore.getState().byDeck["deck-1"]).toEqual({
      ...EMPTY_BENCH_SESSION,
      bench: hand,
    });
  });

  it("keeps earlier fields on a later patch", () => {
    const { patch } = useDeckBenchSessionStore.getState();
    patch("deck-1", { bench: hand });
    patch("deck-1", { selected: new Set(["a-0"]) });
    const session = useDeckBenchSessionStore.getState().byDeck["deck-1"];
    expect(session?.bench).toEqual(hand);
    expect([...(session?.selected ?? [])]).toEqual(["a-0"]);
  });

  it("keeps decks apart", () => {
    useDeckBenchSessionStore.getState().patch("deck-1", { bench: hand });
    expect(useDeckBenchSessionStore.getState().byDeck["deck-2"]).toBeUndefined();
  });

  it("clears one deck and leaves the others", () => {
    const { patch, clear } = useDeckBenchSessionStore.getState();
    patch("deck-1", { bench: hand });
    patch("deck-2", { bench: hand });
    clear("deck-1");
    expect(Object.keys(useDeckBenchSessionStore.getState().byDeck)).toEqual(["deck-2"]);
  });

  it("returns the same state when clearing a deck with no session", () => {
    const before = useDeckBenchSessionStore.getState().byDeck;
    useDeckBenchSessionStore.getState().clear("missing");
    expect(useDeckBenchSessionStore.getState().byDeck).toBe(before);
  });
});
