import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { isRowSelected, mirrorSelectionStore, selectedRowKeys } from "./row-selection-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(mirrorSelectionStore);
});

afterEach(() => {
  resetStore();
});

function state() {
  return mirrorSelectionStore.getState();
}

describe("createRowSelectionStore", () => {
  it("ticks and unticks a row", () => {
    state().toggle("uvsgames:needsDecision:1", "923368", true);
    expect(isRowSelected(state(), "uvsgames:needsDecision:1", "923368")).toBe(true);

    state().toggle("uvsgames:needsDecision:1", "923368", false);
    expect(isRowSelected(state(), "uvsgames:needsDecision:1", "923368")).toBe(false);
  });

  it("drops the old view's keys when a row is picked in another view", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368", "900821"]);
    state().toggle("playriftbound:needsDecision:1", "117424000891345096", true);

    expect(selectedRowKeys(state(), "playriftbound:needsDecision:1")).toEqual([
      "117424000891345096",
    ]);
    expect(selectedRowKeys(state(), "uvsgames:needsDecision:1")).toEqual([]);
  });

  it("reads nothing as selected under a scope it does not hold", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368"]);

    expect(isRowSelected(state(), "uvsgames:needsDecision:2", "923368")).toBe(false);
  });

  it("empties on clear", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368", "900821"]);
    state().clear();

    expect(selectedRowKeys(state(), "uvsgames:needsDecision:1")).toEqual([]);
  });
});
