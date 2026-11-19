// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useTradeFinderStore } from "./trade-finder-store";

const reset = createStoreResetter(useTradeFinderStore);

afterEach(() => {
  reset();
});

describe("useTradeFinderStore", () => {
  it("starts in the person view with nobody open", () => {
    expect(useTradeFinderStore.getState().view).toBe("person");
    expect(useTradeFinderStore.getState().openPersonId).toBeNull();
  });

  it("opens one person at a time and closes them on a second toggle", () => {
    const { togglePerson } = useTradeFinderStore.getState();
    togglePerson("user-ash");
    togglePerson("user-robin");
    expect(useTradeFinderStore.getState().openPersonId).toBe("user-robin");
    togglePerson("user-robin");
    expect(useTradeFinderStore.getState().openPersonId).toBeNull();
  });

  it("restores a stored view and ignores an unknown one", () => {
    const { merge } = useTradeFinderStore.persist.getOptions();
    const current = useTradeFinderStore.getState();
    expect(merge?.({ view: "card" }, current).view).toBe("card");
    expect(merge?.({ view: "grid" }, current).view).toBe("person");
  });

  it("persists only the view", () => {
    const { partialize } = useTradeFinderStore.persist.getOptions();
    useTradeFinderStore.getState().togglePerson("user-ash");
    expect(partialize?.(useTradeFinderStore.getState())).toEqual({ view: "person" });
  });
});
