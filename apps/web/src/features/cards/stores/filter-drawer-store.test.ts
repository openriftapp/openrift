import { afterEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useFilterDrawerStore } from "./filter-drawer-store";

const resetStore = createStoreResetter(useFilterDrawerStore);

afterEach(() => {
  resetStore();
});

describe("useFilterDrawerStore", () => {
  it("starts closed and never-opened", () => {
    expect(useFilterDrawerStore.getState().openOn).toBeNull();
    expect(useFilterDrawerStore.getState().openedOnce).toBe(false);
  });

  it("opening records the pathname and sets openedOnce", () => {
    useFilterDrawerStore.getState().setOpen(true, "/cards");
    expect(useFilterDrawerStore.getState().openOn).toBe("/cards");
    expect(useFilterDrawerStore.getState().openedOnce).toBe(true);
  });

  it("closing clears the pathname and keeps openedOnce latched", () => {
    useFilterDrawerStore.getState().setOpen(true, "/cards");
    useFilterDrawerStore.getState().setOpen(false, "/cards");
    expect(useFilterDrawerStore.getState().openOn).toBeNull();
    expect(useFilterDrawerStore.getState().openedOnce).toBe(true);
  });

  it("closing before any open leaves openedOnce false", () => {
    useFilterDrawerStore.getState().setOpen(false, "/cards");
    expect(useFilterDrawerStore.getState().openedOnce).toBe(false);
  });
});
