import { describe, expect, it } from "vitest";

import { createMultiSelectStore } from "./multi-select-store";

describe("createMultiSelectStore", () => {
  it("starts outside select mode with nothing selected", () => {
    const store = createMultiSelectStore();

    expect(store.getState().selectMode).toBe(false);
    expect(store.getState().selected.size).toBe(0);
  });

  it("keeps each instance's selection to itself", () => {
    const first = createMultiSelectStore();
    const second = createMultiSelectStore();

    first.getState().setSelectMode(true);
    first.getState().toggleSelect("item-1");

    expect(second.getState().selectMode).toBe(false);
    expect(second.getState().selected.size).toBe(0);
  });
});
