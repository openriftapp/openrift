import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useDeckBoxOriginsStore } from "./deck-box-origins-store";

const resetStore = createStoreResetter(useDeckBoxOriginsStore);

beforeEach(resetStore);
afterEach(resetStore);

describe("deck box origins store", () => {
  it("starts empty", () => {
    expect(useDeckBoxOriginsStore.getState().byDeck).toEqual({});
  });

  it("remembers each copy's collection per deck", () => {
    const { remember } = useDeckBoxOriginsStore.getState();
    remember("deck-1", "copy-1", "shelf");
    remember("deck-1", "copy-2", "binder");
    remember("deck-2", "copy-3", "shelf");
    expect(useDeckBoxOriginsStore.getState().byDeck).toEqual({
      "deck-1": { "copy-1": "shelf", "copy-2": "binder" },
      "deck-2": { "copy-3": "shelf" },
    });
  });

  it("forgets only the named copies", () => {
    const { remember, forget } = useDeckBoxOriginsStore.getState();
    remember("deck-1", "copy-1", "shelf");
    remember("deck-1", "copy-2", "binder");
    forget("deck-1", ["copy-1"]);
    expect(useDeckBoxOriginsStore.getState().byDeck["deck-1"]).toEqual({ "copy-2": "binder" });
  });

  it("keeps the state object when there is nothing to forget or clear", () => {
    const before = useDeckBoxOriginsStore.getState().byDeck;
    useDeckBoxOriginsStore.getState().forget("deck-1", ["copy-1"]);
    useDeckBoxOriginsStore.getState().clear("deck-1");
    expect(useDeckBoxOriginsStore.getState().byDeck).toBe(before);
  });

  it("clears one deck and leaves the others", () => {
    const { remember, clear } = useDeckBoxOriginsStore.getState();
    remember("deck-1", "copy-1", "shelf");
    remember("deck-2", "copy-2", "binder");
    clear("deck-1");
    expect(useDeckBoxOriginsStore.getState().byDeck).toEqual({ "deck-2": { "copy-2": "binder" } });
  });
});
