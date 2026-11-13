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

  it("enterSelectAll turns on select mode and replaces the selection with every id", () => {
    const store = createMultiSelectStore();
    store.getState().toggleSelect("stale");

    store.getState().enterSelectAll(["a", "b"]);

    expect(store.getState().selectMode).toBe(true);
    expect([...store.getState().selected].toSorted()).toEqual(["a", "b"]);
  });

  it("enterSelectAll keeps everything selected when called twice", () => {
    const store = createMultiSelectStore();

    store.getState().enterSelectAll(["a", "b"]);
    store.getState().enterSelectAll(["a", "b"]);

    expect(store.getState().selected.size).toBe(2);
  });
});
