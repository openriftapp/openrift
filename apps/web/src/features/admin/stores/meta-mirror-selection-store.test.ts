import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import {
  isMirrorRowSelected,
  selectedMirrorKeys,
  useMetaMirrorSelectionStore,
} from "./meta-mirror-selection-store";

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useMetaMirrorSelectionStore);
});

afterEach(() => {
  resetStore();
});

function state() {
  return useMetaMirrorSelectionStore.getState();
}

describe("useMetaMirrorSelectionStore", () => {
  it("toggles a row in and out of the selection", () => {
    state().toggle("uvsgames:needsDecision:1", "923368");
    expect(isMirrorRowSelected(state(), "uvsgames:needsDecision:1", "923368")).toBe(true);

    state().toggle("uvsgames:needsDecision:1", "923368");
    expect(isMirrorRowSelected(state(), "uvsgames:needsDecision:1", "923368")).toBe(false);
  });

  it("drops the old view's keys when a row is picked in another view", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368", "900821"]);
    state().toggle("playriftbound:needsDecision:1", "117424000891345096");

    expect(selectedMirrorKeys(state(), "playriftbound:needsDecision:1")).toEqual([
      "117424000891345096",
    ]);
    expect(selectedMirrorKeys(state(), "uvsgames:needsDecision:1")).toEqual([]);
  });

  it("reads nothing as selected under a scope it does not hold", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368"]);

    expect(isMirrorRowSelected(state(), "uvsgames:needsDecision:2", "923368")).toBe(false);
  });

  it("empties on clear", () => {
    state().setAll("uvsgames:needsDecision:1", ["923368", "900821"]);
    state().clear();

    expect(selectedMirrorKeys(state(), "uvsgames:needsDecision:1")).toEqual([]);
  });
});
